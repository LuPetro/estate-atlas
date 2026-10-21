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
  PropertyWorkspace,
  WorkspaceSaveInput,
  PropertyShares,
  CreatedPropertyInvitation,
  AccountInfo,
  AccountConfig,
  AccountSession,
  AdminUser,
  AuditEvent,
  AdminOverview,
  PlatformRole,
  PortfolioUsage,
  PortfolioReminder,
  ReminderInput,
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
    // AbortSignal.any/timeout are not available in every React Native runtime.
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    if (options.signal?.aborted) abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        credentials: 'include',
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(
        0,
        timedOut
          ? 'Der Server antwortet gerade nicht. Bitte erneut versuchen.'
          : 'Keine Verbindung zur API. Bitte Verbindung und Serveradresse prüfen.',
      );
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
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
  login(input: { email: string; password: string; code?: string }) {
    return this.request<{ user: User; token?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  logout() {
    return this.request<void>('/auth/logout', { method: 'POST' });
  }
  accountConfig() {
    return this.request<AccountConfig>('/auth/config');
  }
  account() {
    return this.request<AccountInfo>('/account');
  }
  portfolioUsage() {
    return this.request<PortfolioUsage>('/portfolio/usage');
  }
  profile(name: string) {
    return this.request<AccountInfo>('/account/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }
  accountPost<T = { message: string }>(path: string, input: unknown = {}) {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(input) });
  }
  sessions() {
    return this.request<AccountSession[]>('/account/sessions');
  }
  revokeSession(id: string) {
    return this.request<void>(`/account/sessions/${id}`, { method: 'DELETE' });
  }
  forgotPassword(email: string) {
    return this.accountPost('/auth/forgot-password', { email });
  }
  resetPassword(token: string, password: string) {
    return this.accountPost('/auth/reset-password', { token, password });
  }
  verifyEmail(token: string) {
    return this.accountPost('/auth/verify-email', { token });
  }
  adminOverview() {
    return this.request<AdminOverview>('/admin/overview');
  }
  adminUsers(query: string, status: string, verified: string, page: number) {
    const params = new URLSearchParams({ query, page: String(page) });
    if (status) params.set('status', status);
    if (verified) params.set('verified', verified);
    return this.request<{ users: AdminUser[]; total: number; page: number }>(
      `/admin/users?${params}`,
    );
  }
  adminAudit(page = 1) {
    return this.request<AuditEvent[]>(`/admin/audit?page=${page}`);
  }
  adminAction(
    id: string,
    input: {
      action: string;
      password: string;
      code: string;
      reason: string;
      role?: PlatformRole;
      confirmation?: string;
    },
  ) {
    return this.accountPost(`/admin/users/${id}/action`, input);
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
  assets(signal?: AbortSignal) {
    return this.request<Asset[]>('/portfolio/assets', { signal });
  }
  reminders() {
    return this.request<PortfolioReminder[]>('/portfolio/reminders');
  }
  createReminder(propertyId: string, input: ReminderInput) {
    return this.request<PortfolioReminder>(`/properties/${propertyId}/reminders`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  setReminderCompleted(propertyId: string, reminderId: string, completed: boolean) {
    return this.request<PortfolioReminder>(`/properties/${propertyId}/reminders/${reminderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
  }
  deleteReminder(propertyId: string, reminderId: string) {
    return this.request<void>(`/properties/${propertyId}/reminders/${reminderId}`, {
      method: 'DELETE',
    });
  }
  propertyWorkspace(id: string) {
    return this.request<PropertyWorkspace>(`/properties/${id}/workspace`);
  }
  savePropertyWorkspace(id: string, input: WorkspaceSaveInput) {
    return this.request<PropertyWorkspace>(`/properties/${id}/workspace`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }
  shares(id: string) {
    return this.request<PropertyShares>(`/properties/${id}/shares`);
  }
  createInvitation(id: string, role: 'viewer' | 'editor') {
    return this.request<CreatedPropertyInvitation>(`/properties/${id}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  }
  revokeInvitation(propertyId: string, invitationId: string) {
    return this.request<void>(`/properties/${propertyId}/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  }
  revokeShare(propertyId: string, userId: string) {
    return this.request<void>(`/properties/${propertyId}/shares/${userId}`, { method: 'DELETE' });
  }
  acceptInvitation(code: string) {
    return this.request<Property>('/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }
  detail(id: string) {
    return this.request<PropertyDetail>(`/properties/${id}`);
  }
  create(input: PropertyInput) {
    return this.request<Property>('/properties', { method: 'POST', body: JSON.stringify(input) });
  }
  importProperties(input: PropertyInput[]) {
    return this.request<Property[]>('/properties/import', {
      method: 'POST',
      body: JSON.stringify(input),
    });
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
  assetUrl(id: string, download = false) {
    return `${this.baseUrl}/assets/${id}${download ? '?download=1' : ''}`;
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
