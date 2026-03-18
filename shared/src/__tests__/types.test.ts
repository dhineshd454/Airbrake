import {
  LogRecord,
  Break,
  BreakGroup,
  User,
  AlertRule,
  SavedFilter,
  RetentionPolicy,
  NotificationChannel,
  Role,
} from '../types';

describe('Shared type definitions', () => {
  it('LogRecord shape is valid', () => {
    const record: LogRecord = {
      id: 'log-1',
      applicationId: 'app-1',
      environment: 'production',
      severity: 'error',
      message: 'Something went wrong',
      timestamp: new Date('2024-01-01T00:00:00Z'),
      tags: ['api', 'auth'],
      rawPayload: { key: 'value' },
    };
    expect(record.id).toBe('log-1');
    expect(record.environment).toBe('production');
    expect(record.severity).toBe('error');
  });

  it('Break shape is valid', () => {
    const b: Break = {
      id: 'break-1',
      applicationId: 'app-1',
      environment: 'production',
      severity: 'critical',
      errorMessage: 'NullPointerException',
      stackTrace: 'at foo.bar (foo.ts:10)',
      endpoint: '/api/users',
      requestPayload: { userId: '123' },
      userSession: null,
      timestamp: new Date('2024-01-01T00:00:00Z'),
      fingerprint: 'abc123',
    };
    expect(b.fingerprint).toBe('abc123');
    expect(b.userSession).toBeNull();
  });

  it('BreakGroup shape is valid', () => {
    const group: BreakGroup = {
      id: 'group-1',
      fingerprint: 'abc123',
      applicationId: 'app-1',
      firstOccurrence: new Date('2024-01-01T00:00:00Z'),
      lastOccurrence: new Date('2024-01-02T00:00:00Z'),
      occurrenceCount: 5,
      status: 'open',
      severity: 'error',
      errorMessage: 'NullPointerException',
    };
    expect(group.status).toBe('open');
    expect(group.occurrenceCount).toBe(5);
  });

  it('User shape is valid', () => {
    const user: User = {
      id: 'user-1',
      email: 'dev@example.com',
      role: 'developer',
      oauthProvider: 'google',
      oauthSubject: 'sub-123',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };
    expect(user.role).toBe('developer');
  });

  it('Role type accepts valid values', () => {
    const roles: Role[] = ['admin', 'developer', 'viewer'];
    expect(roles).toHaveLength(3);
  });

  it('NotificationChannel discriminated union works', () => {
    const channels: NotificationChannel[] = [
      { type: 'email', address: 'ops@example.com' },
      { type: 'slack', webhookUrl: 'https://hooks.slack.com/xxx' },
      { type: 'teams', webhookUrl: 'https://outlook.office.com/xxx' },
      { type: 'webhook', url: 'https://example.com/hook' },
    ];
    expect(channels[0].type).toBe('email');
    expect(channels[1].type).toBe('slack');
  });

  it('AlertRule shape is valid', () => {
    const rule: AlertRule = {
      id: 'rule-1',
      name: 'High error rate',
      threshold: 10,
      windowSeconds: 60,
      triggerOnNewError: true,
      channels: [{ type: 'email', address: 'ops@example.com' }],
      createdBy: 'user-1',
      enabled: true,
    };
    expect(rule.threshold).toBe(10);
    expect(rule.enabled).toBe(true);
  });

  it('SavedFilter shape is valid', () => {
    const filter: SavedFilter = {
      id: 'filter-1',
      userId: 'user-1',
      name: 'Production errors',
      criteria: {
        severity: ['error', 'critical'],
        applications: ['app-1'],
        timeRange: {
          from: new Date('2024-01-01T00:00:00Z'),
          to: new Date('2024-01-07T00:00:00Z'),
        },
      },
    };
    expect(filter.criteria.severity).toContain('critical');
  });

  it('RetentionPolicy accepts only 30/60/90 days', () => {
    const policies: RetentionPolicy[] = [
      { applicationId: 'app-1', retentionDays: 30 },
      { applicationId: 'app-2', retentionDays: 60 },
      { applicationId: 'app-3', retentionDays: 90 },
    ];
    expect(policies.map((p) => p.retentionDays)).toEqual([30, 60, 90]);
  });
});
