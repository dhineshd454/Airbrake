/**
 * Unit tests for role-gated UI components.
 * Requirements: 6.3, 6.4, 6.5
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AlertManagement } from '../AlertManagement';
import { Settings } from '../../settings/Settings';

const mockRules = [
  {
    id: 'rule-1',
    name: 'High Error Rate',
    threshold: 10,
    windowSeconds: 60,
    triggerOnNewError: false,
    channels: [],
    createdBy: 'user-1',
    enabled: true,
  },
];

const mockUsers = [
  {
    id: 'user-1',
    email: 'admin@example.com',
    role: 'admin',
    oauthProvider: 'google',
    oauthSubject: 'sub-1',
    createdAt: new Date().toISOString(),
  },
];

const mockRetention = { applicationId: 'app-a', retentionDays: 30 };

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('AlertManagement — role gating', () => {
  it('renders for admin role', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => mockRules,
    });
    render(<AlertManagement role="admin" />);
    await waitFor(() => expect(screen.getByTestId('alert-management')).toBeInTheDocument());
    expect(screen.getByTestId('create-rule')).toBeInTheDocument();
  });

  it('renders for developer role', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => mockRules,
    });
    render(<AlertManagement role="developer" />);
    await waitFor(() => expect(screen.getByTestId('alert-management')).toBeInTheDocument());
  });

  it('is hidden for viewer role', () => {
    render(<AlertManagement role="viewer" />);
    expect(screen.queryByTestId('alert-management')).not.toBeInTheDocument();
  });

  it('renders alert rule items', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => mockRules,
    });
    render(<AlertManagement role="admin" />);
    await waitFor(() => expect(screen.getByTestId('alert-rule-item')).toBeInTheDocument());
    expect(screen.getByTestId('rule-name')).toHaveTextContent('High Error Rate');
    expect(screen.getByTestId('rule-threshold')).toHaveTextContent('10');
  });
});

describe('Settings — role gating', () => {
  it('renders for admin role', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => mockUsers })
      .mockResolvedValueOnce({ json: async () => mockRetention });
    render(<Settings role="admin" />);
    await waitFor(() => expect(screen.getByTestId('settings')).toBeInTheDocument());
    expect(screen.getByTestId('user-management')).toBeInTheDocument();
    expect(screen.getByTestId('retention-settings')).toBeInTheDocument();
  });

  it('is hidden for developer role', () => {
    render(<Settings role="developer" />);
    expect(screen.queryByTestId('settings')).not.toBeInTheDocument();
  });

  it('is hidden for viewer role', () => {
    render(<Settings role="viewer" />);
    expect(screen.queryByTestId('settings')).not.toBeInTheDocument();
  });

  it('renders user rows', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => mockUsers })
      .mockResolvedValueOnce({ json: async () => mockRetention });
    render(<Settings role="admin" />);
    await waitFor(() => expect(screen.getByTestId('user-row')).toBeInTheDocument());
    expect(screen.getByTestId('user-email')).toHaveTextContent('admin@example.com');
    expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
  });
});
