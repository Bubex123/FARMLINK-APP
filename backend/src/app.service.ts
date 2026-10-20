import { BadRequestException, ConflictException, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHmac, type ScryptOptions } from 'node:crypto';
import { DatabaseService } from './database.service';
import type { Order, Product, Seller, Store, User } from './store.models';

const scrypt = (password: string, salt: string, keyLength: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCallback(password, salt, keyLength, options, (error, key) => error ? reject(error) : resolve(key)));
const SCRYPT_N = 1 << 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;
@Injectable()
export class AppService {
  private readonly jwtSecret = this.requireJwtSecret();

  constructor(private readonly database: DatabaseService) {}

  private requireJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error('JWT_SECRET must be set to a random value of at least 32 characters before starting the API.');
    }
    return secret;
  }

  private async store(): Promise<Store> {
    return this.database.loadStore();
  }

  private async save(data: Store) {
    await this.database.saveStore(data);
  }

  private publicUser(user: User) {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  private async passwordHash(password: string) {
    const salt = randomBytes(16).toString('hex');
    const key = await scrypt(password, salt, 64, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM }) as Buffer;
    return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${key.toString('hex')}`;
  }

  private async passwordMatches(password: string, stored: string) {
    const parts = stored.split('$');
    const modern = parts.length === 6 && parts[0] === 'scrypt';
    const [salt, value] = modern ? [parts[4], parts[5]] : stored.split(':');
    if (!salt || !value) return false;
    const options = modern
      ? { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]), maxmem: SCRYPT_MAXMEM }
      : { N: 1 << 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
    const actual = await scrypt(password, salt, 64, options) as Buffer;
    const expected = Buffer.from(value, 'hex');
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  }

  private token(user: User) {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: 'farmlink-api', aud: 'farmlink-app', sub: user.id, role: user.role, iat: now, exp: now + 60 * 60 * 24 })}`;
    return `${unsigned}.${createHmac('sha256', this.jwtSecret).update(unsigned).digest('base64url')}`;
  }

  register = async (input: Record<string, unknown>) => {
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    const firstName = String(input.firstName || '').trim();
    const lastName = String(input.lastName || '').trim();
    const role = String(input.role || 'buyer');
    if (!email.includes('@') || password.length < 8 || !firstName || !lastName) throw new BadRequestException('Enter a valid email, first name, last name, and password of at least 8 characters.');
    if (!['buyer', 'seller', 'rider'].includes(role)) throw new BadRequestException('This role cannot be self-registered.');
    const passwordHash = await this.passwordHash(password);
    return this.database.transaction(async () => {
      const data = await this.store();
      if (data.users.some((user) => user.email === email)) throw new ConflictException('An account with this email already exists.');
      const user: User = { id: randomUUID(), email, firstName, lastName, phone: String(input.phone || ''), role, passwordHash, createdAt: new Date().toISOString() };
      data.users.push(user);
      await this.save(data);
      return { user: this.publicUser(user), accessToken: this.token(user), refreshToken: this.token(user), expiresIn: '86400s' };
    });
  };

  login = async (input: Record<string, unknown>) => {
    const email = String(input.email || '').trim().toLowerCase();
    const data = await this.store();
    const user = data.users.find((item) => item.email === email);
    if (!user || !(await this.passwordMatches(String(input.password || ''), user.passwordHash))) throw new UnauthorizedException('Email or password is incorrect.');
    if (!user.passwordHash.startsWith('scrypt$')) {
      const upgradedHash = await this.passwordHash(String(input.password || ''));
      await this.database.transaction(async () => {
        const latest = await this.store();
        const latestUser = latest.users.find((item) => item.id === user.id);
        if (latestUser && !latestUser.passwordHash.startsWith('scrypt$')) {
          latestUser.passwordHash = upgradedHash;
          await this.save(latest);
        }
      });
    }
    return { user: this.publicUser(user), accessToken: this.token(user), refreshToken: this.token(user), expiresIn: '86400s' };
  };

  authenticate(token: string) {
    try {
      const [header, payload, signature] = token.split('.');
      if (!header || !payload || !signature) throw new Error('invalid token');
      const unsigned = `${header}.${payload}`;
      const expected = createHmac('sha256', this.jwtSecret).update(unsigned).digest();
      const actual = Buffer.from(signature, 'base64url');
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('invalid signature');
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { iss: string; aud: string; sub: string; exp: number; role: string };
      if (claims.iss !== 'farmlink-api' || claims.aud !== 'farmlink-app' || !claims.sub || claims.exp < Date.now() / 1000) throw new Error('invalid claims');
      return { id: claims.sub, role: claims.role };
    } catch { throw new UnauthorizedException('Your session is invalid or expired. Please log in again.'); }
  }

  requireRole(token: string, role: string) {
    if (this.authenticate(token).role !== role) throw new ForbiddenException('You do not have permission to access this resource.');
  }

  async listProducts(limitText?: string, offsetText?: string) {
    const data = await this.store();
    const visible = data.products.filter((product) => product.isActive && data.sellers.some((seller) => seller.id === product.sellerId && seller.verificationStatus === 'verified'));
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitText || '48', 10) || 48));
    const offset = Math.max(0, Number.parseInt(offsetText || '0', 10) || 0);
    const joined = visible.map((product) => this.withSeller(product, data.sellers));
    return { data: joined.slice(offset, offset + limit), total: joined.length };
  }

  private page<T>(items: T[], limitText?: string, offsetText?: string) {
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitText || '100', 10) || 100));
    const offset = Math.max(0, Number.parseInt(offsetText || '0', 10) || 0);
    return { data: items.slice(offset, offset + limit), total: items.length };
  }

  async adminOverview() {
    const data = await this.store();
    const farmers = data.sellers;
    const orders = data.orders || [];
    return {
      totalUsers: data.users.length,
      customers: data.users.filter((user) => user.role === 'buyer').length,
      sellerAccounts: data.users.filter((user) => user.role === 'seller').length,
      totalFarmers: farmers.length,
      pendingFarmers: farmers.filter((seller) => seller.verificationStatus === 'pending').length,
      verifiedFarmers: farmers.filter((seller) => seller.verificationStatus === 'verified').length,
      totalProducts: data.products.length,
      totalOrders: orders.length,
      pendingOrders: orders.filter((order) => order.status === 'pending').length,
      deliveredOrders: orders.filter((order) => order.status === 'delivered').length,
      pendingPayments: 0, completedPayments: 0, completedPaymentAmount: 0,
    };
  }

  async adminUsers(limit?: string, offset?: string) {
    const data = await this.store();
    return this.page(data.users.map((user) => this.publicUser(user)), limit, offset);
  }

  async adminSellers(limit?: string, offset?: string) {
    const data = await this.store();
    const sellers = data.sellers.map((seller) => {
      const user = data.users.find((item) => item.id === seller.userId);
      return { ...seller, user: user ? this.publicUser(user) : undefined };
    });
    return this.page(sellers, limit, offset);
  }

  async adminProducts(limit?: string, offset?: string) {
    const data = await this.store();
    return this.page(data.products.map((product) => this.withSeller(product, data.sellers)), limit, offset);
  }

  async currentUser(userId: string) {
    const data = await this.store();
    const user = data.users.find((item) => item.id === userId);
    if (!user) throw new UnauthorizedException('Account not found. Please log in again.');
    return this.publicUser(user);
  }

  private orderView(order: Order, data: Store) {
    const buyer = data.users.find((item) => item.id === order.buyerId);
    const seller = data.sellers.find((item) => item.id === order.sellerId);
    const product = data.products.find((item) => item.id === order.productId);
    const { smsActionCode: _smsActionCode, ...publicOrder } = order;
    return {
      ...publicOrder,
      buyer: buyer ? this.publicUser(buyer) : undefined,
      seller: seller ? { id: seller.id, farmName: seller.farmName, email: seller.email, phone: seller.phone } : undefined,
      product: product ? { id: product.id, name: product.name, category: product.category, unit: product.unit } : undefined,
    };
  }

  async adminOrders(limit?: string, offset?: string) {
    const data = await this.store();
    const rows = (data.orders || []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((order) => this.orderView(order, data));
    return this.page(rows, limit, offset);
  }

  async sellerOrders(userId: string, limit?: string, offset?: string) {
    const data = await this.store();
    const seller = data.sellers.find((item) => item.userId === userId);
    const rows = (data.orders || []).filter((order) => order.sellerId === seller?.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((order) => this.orderView(order, data));
    return this.page(rows, limit, offset);
  }

  async buyerOrders(userId: string, limit?: string, offset?: string) {
    const data = await this.store();
    const rows = (data.orders || []).filter((order) => order.buyerId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((order) => this.orderView(order, data));
    return this.page(rows, limit, offset);
  }

  async createOrder(userId: string, input: Record<string, unknown>) {
    const result = await this.database.transaction(async () => {
    const data = await this.store();
    const buyer = data.users.find((user) => user.id === userId);
    if (!buyer || buyer.role !== 'buyer') throw new ForbiddenException('Only buyer accounts can place orders.');
    const product = data.products.find((item) => item.id === String(input.productId || '') && item.isActive);
    const seller = product && data.sellers.find((item) => item.id === product.sellerId && item.verificationStatus === 'verified');
    const quantity = Number(input.quantity);
    if (!product || !seller) throw new BadRequestException('This product is unavailable.');
    if (!Number.isInteger(quantity) || quantity < 1) throw new BadRequestException('Order quantity must be a positive whole number.');
    if (product.quantity < quantity) throw new BadRequestException('There is not enough stock for this order.');
    const deliveryAddress = String(input.deliveryAddress || '').trim();
    const deliveryCity = String(input.deliveryCity || '').trim();
    const deliveryPhone = String(input.deliveryPhone || '').trim();
    if (deliveryAddress.length < 5 || !deliveryCity || !deliveryPhone) throw new BadRequestException('Delivery address, city, and phone are required.');
    const now = new Date();
    const order: Order = {
      id: randomUUID(), orderNumber: `FL-${now.getTime().toString().slice(-8)}-${randomBytes(2).toString('hex').toUpperCase()}`,
      buyerId: buyer.id, sellerId: seller.id, productId: product.id, quantity, unitPrice: product.price,
      totalPrice: product.price * quantity, deliveryFee: 0, status: 'pending', paymentStatus: 'cash_on_delivery',
      deliveryAddress, deliveryCity, deliveryPhone, specialInstructions: String(input.specialInstructions || ''), createdAt: now.toISOString(), updatedAt: now.toISOString(),
    };
    const smsCredentialsReady = Boolean(process.env.AT_USERNAME && process.env.AT_API_KEY);
    if (seller.smsOrderAlerts && smsCredentialsReady && seller.phone) order.smsActionCode = randomBytes(6).toString('hex').toUpperCase();
    product.quantity -= quantity;
    data.orders ||= [];
    data.orders.push(order);
    await this.save(data);
    return { order: this.orderView(order, data), sellerPhone: seller.phone, sellerSmsOptIn: Boolean(seller.smsOrderAlerts), productName: product.name, actionCode: order.smsActionCode };
    });
    if (result.sellerSmsOptIn && result.actionCode) {
      const message = `FarmLink order ${result.order.orderNumber}: ${result.order.quantity} x ${result.productName}. Reply YES ${result.order.orderNumber} ${result.actionCode} to confirm or NO ${result.order.orderNumber} ${result.actionCode} to reject. Call the buyer at ${result.order.deliveryPhone} if needed.`;
      try {
        await this.sendSms(result.sellerPhone, message);
      } catch (error) {
        console.error('FarmLink order SMS could not be sent:', error instanceof Error ? error.message : 'SMS provider error');
      }
    }
    return result.order;
  }

  private async sendSms(to: string, message: string) {
    const username = process.env.AT_USERNAME;
    const apiKey = process.env.AT_API_KEY;
    if (!username || !apiKey) return;
    const form = new URLSearchParams({ username, to, message });
    if (process.env.AT_SENDER_ID) form.set('from', process.env.AT_SENDER_ID);
    const apiHost = process.env.AT_ENVIRONMENT === 'sandbox' ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com';
    const response = await fetch(`${apiHost}/version1/messaging`, {
      method: 'POST',
      headers: { apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`SMS provider returned HTTP ${response.status}.`);
    const payload = await response.json() as { SMSMessageData?: { Recipients?: Array<{ status?: string; statusCode?: number }> } };
    const recipient = payload.SMSMessageData?.Recipients?.[0];
    if (recipient && Number(recipient.statusCode) !== 101) throw new Error(recipient.status || `SMS provider status ${recipient.statusCode}.`);
  }

  async handleFarmerSmsReply(from: string, text: string) {
    if (from.length > 40 || text.length > 300) throw new BadRequestException('Invalid SMS callback.');
    const match = text.trim().match(/^(YES|NO)\s+(FL-[A-Z0-9-]+)\s+([A-F0-9]{12})$/i);
    if (!match) throw new BadRequestException('Reply YES <order number> <code> to confirm, or NO <order number> <code> to reject.');
    const [, command, orderNumber, code] = match;
    const phoneDigits = (value: string) => {
      const digits = value.replace(/\D/g, '');
      return digits.startsWith('0') ? `255${digits.slice(1)}` : digits;
    };
    return this.database.transaction(async () => {
      const data = await this.store();
      const order = (data.orders || []).find((item) => item.orderNumber.toLowerCase() === orderNumber.toLowerCase());
      const seller = order && data.sellers.find((item) => item.id === order.sellerId);
      if (!order || !seller?.smsOrderAlerts || !order.smsActionCode || order.smsActionCode !== code.toUpperCase() || phoneDigits(seller.phone) !== phoneDigits(from)) {
        throw new UnauthorizedException('This SMS could not be matched to an active order and farmer phone.');
      }
      if (order.status !== 'pending') throw new BadRequestException(`Order ${order.orderNumber} is already ${order.status}.`);
      order.status = command.toUpperCase() === 'YES' ? 'confirmed' : 'rejected';
      delete order.smsActionCode;
      order.updatedAt = new Date().toISOString();
      await this.save(data);
      return { status: 'ok', message: `Order ${order.orderNumber} ${order.status}.` };
    });
  }

  async updateOrder(userId: string, orderId: string, status: string) {
    return this.database.transaction(async () => {
    const allowed = ['confirmed', 'rejected', 'shipped', 'delivered'];
    if (!allowed.includes(status)) throw new BadRequestException('Choose a valid order status.');
    const data = await this.store();
    const seller = data.sellers.find((item) => item.userId === userId);
    const order = (data.orders || []).find((item) => item.id === orderId && item.sellerId === seller?.id);
    if (!seller || !order) throw new ForbiddenException('This order does not belong to your farm.');
    const transitions: Record<string, string[]> = { pending: ['confirmed', 'rejected'], confirmed: ['shipped'], shipped: ['delivered'] };
    if (!transitions[order.status]?.includes(status)) throw new BadRequestException(`Order cannot move from ${order.status} to ${status}.`);
    order.status = status;
    delete order.smsActionCode;
    order.updatedAt = new Date().toISOString();
    await this.save(data);
    return this.orderView(order, data);
    });
  }

  private withSeller(product: Product, sellers: Seller[]) {
    const seller = sellers.find((item) => item.id === product.sellerId);
    const { sellerId: _sellerId, ...safe } = product;
    return { ...safe, seller: seller ? { id: seller.id, farmName: seller.farmName, region: seller.region, city: seller.city, rating: seller.rating } : undefined };
  }

  async myProducts(userId: string) {
    const data = await this.store();
    const seller = data.sellers.find((item) => item.userId === userId);
    if (!seller) return [];
    return data.products.filter((item) => item.sellerId === seller.id).map((item) => this.withSeller(item, data.sellers));
  }

  async createProduct(userId: string, input: Record<string, unknown>) {
    return this.database.transaction(async () => {
    const data = await this.store();
    const seller = data.sellers.find((item) => item.userId === userId);
    if (!seller) throw new BadRequestException('Submit your farm profile before adding products.');
    if (seller.verificationStatus !== 'verified') throw new ForbiddenException('Your farm must be approved before adding products.');
    const name = String(input.name || '').trim();
    const price = Number(input.price);
    const quantity = Number(input.quantity);
    if (name.length < 2 || !Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity < 0) throw new BadRequestException('Enter a product name, positive price, and valid quantity.');
    const product: Product = { id: randomUUID(), sellerId: seller.id, name, description: String(input.description || ''), category: String(input.category || 'other'), price, quantity, unit: String(input.unit || 'unit'), images: Array.isArray(input.images) ? input.images.map(String).slice(0, 8) : [], isActive: true, rating: 0, createdAt: new Date().toISOString() };
    data.products.push(product);
    await this.save(data);
    return this.withSeller(product, data.sellers);
    });
  }

  async createSeller(userId: string, input: Record<string, unknown>) {
    return this.database.transaction(async () => {
    const data = await this.store();
    const user = data.users.find((item) => item.id === userId);
    if (!user || user.role !== 'seller') throw new ForbiddenException('Only farmer accounts can submit farm details.');
    const existing = data.sellers.find((item) => item.userId === userId);
    if (existing) throw new ConflictException('A farm profile already exists for this account.');
    const required = ['farmName', 'address', 'city', 'region'];
    if (required.some((key) => !String(input[key] || '').trim())) throw new BadRequestException('Farm name, address, city, and region are required.');
    const seller: Seller = { id: randomUUID(), userId, farmName: String(input.farmName).trim(), description: String(input.description || ''), contactPerson: String(input.contactPerson || `${user.firstName} ${user.lastName}`), phone: String(input.phone || user.phone), email: String(input.email || user.email), address: String(input.address), city: String(input.city), region: String(input.region), verificationStatus: 'pending', rating: 0, totalOrders: 0, totalReviews: 0, smsOrderAlerts: input.smsOrderAlerts === true };
    data.sellers.push(seller);
    await this.save(data);
    return seller;
    });
  }

  async mySeller(userId: string) {
    const data = await this.store();
    return data.sellers.find((item) => item.userId === userId) || null;
  }

  async updateMySellerSmsPreference(userId: string, enabled: boolean) {
    return this.database.transaction(async () => {
      const data = await this.store();
      const seller = data.sellers.find((item) => item.userId === userId);
      if (!seller) throw new BadRequestException('Submit your farm profile before changing SMS preferences.');
      seller.smsOrderAlerts = enabled;
      await this.save(data);
      return { smsOrderAlerts: seller.smsOrderAlerts };
    });
  }

  async updateSellerVerification(id: string, status: string) {
    return this.database.transaction(async () => {
    if (!['pending', 'verified', 'rejected', 'suspended'].includes(status)) throw new BadRequestException('Choose a valid farm review status.');
    const data = await this.store();
    const seller = data.sellers.find((item) => item.id === id);
    if (!seller) throw new BadRequestException('Farm profile not found.');
    seller.verificationStatus = status;
    await this.save(data);
    return seller;
    });
  }
}
