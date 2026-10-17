const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/$/, "");

type ApiErrorBody = { message?: string | string[] };

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("Could not reach the FarmLink server. Check that the API is running and try again.");
  }

  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(" ") : body.message;
    throw new ApiError(message || `FarmLink server returned an error (${response.status}).`);
  }

  return body as T;
}

export function normalizeTanzanianPhone(phone: string) {
  const compact = phone.replace(/[\s()-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("0")) return `+255${compact.slice(1)}`;
  if (compact.startsWith("255")) return `+${compact}`;
  return compact;
}

export type ApiUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "buyer" | "seller" | "rider" | "admin";
};

export type AuthResponse = {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export function saveAuth(response: AuthResponse) {
  localStorage.setItem("accessToken", response.accessToken);
  localStorage.setItem("refreshToken", response.refreshToken);
  localStorage.setItem("user", JSON.stringify(response.user));
}
