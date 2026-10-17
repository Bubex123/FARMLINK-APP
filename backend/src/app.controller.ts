import { BadRequestException, Body, Controller, Get, Headers, Post, Query, UnauthorizedException, Param, Put } from '@nestjs/common';
import { AppService } from './app.service';

function inputBody(value: unknown, allowed: string[], required: string[] = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Request body must be a JSON object.');
  const body = value as Record<string, unknown>;
  const extra = Object.keys(body).filter((key) => !allowed.includes(key));
  if (extra.length) throw new BadRequestException(`Unexpected field: ${extra[0]}.`);
  const missing = required.find((key) => body[key] === undefined || body[key] === null || body[key] === '');
  if (missing) throw new BadRequestException(`Missing required field: ${missing}.`);
  for (const [key, item] of Object.entries(body)) {
    if (typeof item === 'string' && item.length > 2000) throw new BadRequestException(`${key} is too long.`);
  }
  return body;
}

@Controller()
export class AppController {
  constructor(private readonly service: AppService) {}

  @Get('health')
  health() { return { status: 'ok', service: 'FarmLink API' }; }

  @Post('auth/register')
  register(@Body() value: unknown) { return this.service.register(inputBody(value, ['email', 'password', 'firstName', 'lastName', 'phone', 'role'], ['email', 'password', 'firstName', 'lastName'])); }

  @Post('auth/login')
  login(@Body() value: unknown) { return this.service.login(inputBody(value, ['email', 'password'], ['email', 'password'])); }

  @Get('products')
  products(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.service.listProducts(limit, offset);
  }

  @Get('products/mine')
  myProducts(@Headers('authorization') auth?: string) {
    return this.service.myProducts(this.userId(auth));
  }

  @Get('products/admin/all')
  allProducts(@Headers('authorization') auth?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    this.service.requireRole(this.token(auth), 'admin');
    return this.service.adminProducts(limit, offset);
  }

  @Get('admin/overview')
  overview(@Headers('authorization') auth?: string) {
    this.service.requireRole(this.token(auth), 'admin');
    return this.service.adminOverview();
  }

  @Get('users')
  users(@Headers('authorization') auth?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    this.service.requireRole(this.token(auth), 'admin');
    return this.service.adminUsers(limit, offset);
  }

  @Get('users/me')
  me(@Headers('authorization') auth?: string) {
    return this.service.currentUser(this.userId(auth));
  }

  @Get('sellers/admin/all')
  sellers(@Headers('authorization') auth?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    this.service.requireRole(this.token(auth), 'admin');
    return this.service.adminSellers(limit, offset);
  }

  @Get('orders/admin/all')
  orders(@Headers('authorization') auth?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    this.service.requireRole(this.token(auth), 'admin');
    return this.service.adminOrders(limit, offset);
  }

  @Get('orders/seller')
  sellerOrders(@Headers('authorization') auth?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.service.sellerOrders(this.userId(auth), limit, offset);
  }

  @Get('orders/mine')
  buyerOrders(@Headers('authorization') auth?: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.service.buyerOrders(this.userId(auth), limit, offset);
  }

  @Post('orders')
  createOrder(@Headers('authorization') auth: string | undefined, @Body() value: unknown) {
    const body = inputBody(value, ['productId', 'quantity', 'deliveryAddress', 'deliveryCity', 'deliveryPhone', 'specialInstructions'], ['productId', 'quantity', 'deliveryAddress', 'deliveryCity', 'deliveryPhone']);
    return this.service.createOrder(this.userId(auth), body);
  }

  @Put('orders/:id/status')
  updateOrder(@Headers('authorization') auth: string | undefined, @Param('id') id: string, @Body() value: unknown) {
    const body = inputBody(value, ['status'], ['status']);
    return this.service.updateOrder(this.userId(auth), id, String(body.status || ''));
  }

  @Get('payments/admin/all')
  payments(@Headers('authorization') auth?: string) {
    this.service.requireRole(this.token(auth), 'admin');
    return { data: [], total: 0 };
  }

  @Post('products')
  createProduct(@Headers('authorization') auth: string | undefined, @Body() value: unknown) {
    const body = inputBody(value, ['name', 'description', 'category', 'price', 'quantity', 'unit', 'images'], ['name', 'category', 'price', 'quantity', 'unit']);
    if (body.images !== undefined && (!Array.isArray(body.images) || body.images.length > 8 || body.images.some((image) => typeof image !== 'string' || image.length > 2000))) throw new BadRequestException('Images must be a list of at most 8 valid strings.');
    return this.service.createProduct(this.userId(auth), body);
  }

  @Post('sellers')
  createSeller(@Headers('authorization') auth: string | undefined, @Body() value: unknown) {
    const body = inputBody(value, ['farmName', 'contactPerson', 'phone', 'email', 'address', 'city', 'region', 'description'], ['farmName', 'address', 'city', 'region']);
    return this.service.createSeller(this.userId(auth), body);
  }

  @Get('sellers/me')
  mySeller(@Headers('authorization') auth?: string) {
    return this.service.mySeller(this.userId(auth));
  }

  @Put('sellers/:id/verification')
  verifySeller(@Headers('authorization') auth: string | undefined, @Param('id') id: string, @Body() value: unknown) {
    this.service.requireRole(this.token(auth), 'admin');
    const body = inputBody(value, ['status'], ['status']);
    return this.service.updateSellerVerification(id, String(body.status || ''));
  }

  private token(header?: string) {
    const token = header?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Please log in to continue.');
    return token;
  }

  private userId(header?: string) { return this.service.authenticate(this.token(header)).id; }
}
