import type { AnalysisConfig } from '@estate-atlas/shared/analysis';
import type {
  Property,
  PropertyInput,
  PropertyDetail,
  User,
  Asset,
  AnalysisJob,
  GeocodingResult,
  Valuation,
} from '@estate-atlas/shared';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export class ApiClient {
  constructor(
    public baseUrl: string,
    private getToken: () => string | null = () => null,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    const token = this.getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body && !(options.body instanceof FormData))
      headers.set('Content-Type', 'application/json');
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    } catch {
      throw new ApiError(0, 'Keine Verbindung zur API. Bitte Verbindung und Serveradresse prüfen.');
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message ?? 'Die Anfrage ist fehlgeschlagen.');
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  }
  me() {
    return this.request<User>('/auth/me');
  }
  register(input: { email: string; password: string; name: string }) {
    return this.request<{ user: User; token?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  login(input: { email: string; password: string }) {
    return this.request<{ user: User; token?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  logout() {
    return this.request<void>('/auth/logout', { method: 'POST' });
  }
  searchAddress(query: string, signal?: AbortSignal) {
    return this.request<GeocodingResult[]>('/geocoding/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
      signal,
    });
  }
  properties() {
    return this.request<Property[]>('/properties');
  }
  valuations(signal?: AbortSignal) {
    return this.request<Valuation[]>('/portfolio/valuations', { signal });
  }
  detail(id: string) {
    return this.request<PropertyDetail>(`/properties/${id}`);
  }
  create(input: PropertyInput) {
    return this.request<Property>('/properties', { method: 'POST', body: JSON.stringify(input) });
  }
  update(id: string, input: PropertyInput) {
    return this.request<Property>(`/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }
  archive(id: string, archived: boolean) {
    return this.request<Property>(`/properties/${id}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ archived }),
    });
  }
  delete(id: string) {
    return this.request<void>(`/properties/${id}`, { method: 'DELETE' });
  }
  seed() {
    return this.request<Property[]>('/properties/test-data', { method: 'POST' });
  }
  upload(id: string, file: File | { uri: string; name: string; type: string }) {
    const body = new FormData();
    body.append('file', file as Blob);
    return this.request<Asset>(`/properties/${id}/assets`, { method: 'POST', body });
  }
  deleteAsset(id: string) {
    return this.request<void>(`/assets/${id}`, { method: 'DELETE' });
  }
  assetUrl(id: string) {
    return `${this.baseUrl}/assets/${id}`;
  }
  analyse(id: string, input?: { model: string; consent: true }) {
    return this.request<AnalysisJob>(`/properties/${id}/analyses`, {
      method: 'POST',
      body: input ? JSON.stringify(input) : undefined,
    });
  }
  analysisConfig() {
    return this.request<AnalysisConfig>('/analyses/config');
  }
  analysis(id: string, signal?: AbortSignal) {
    return this.request<AnalysisJob>(`/analyses/${id}`, { signal });
  }
  cancelAnalysis(id: string) {
    return this.request<AnalysisJob>(`/analyses/${id}/cancel`, { method: 'POST' });
  }
  applyAnalysis(id: string) {
    return this.request<AnalysisJob>(`/analyses/${id}/apply`, { method: 'POST' });
  }
}
