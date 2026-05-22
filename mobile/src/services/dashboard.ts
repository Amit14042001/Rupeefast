/**
 * RupeeFast — Dashboard Service
 *
 * Fetches role-specific dashboard data from the backend.
 * Falls back gracefully when backend is offline.
 */

import { apiFetch } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { useAuthStore } from '../stores/auth-store';
import type { DashboardResponse, Loan } from '../types';

export interface BorrowerDashboardData {
  user: DashboardResponse['user'];
  activeLoan?: Loan;
  recentRepayments: DashboardResponse['recentRepayments'];
  loanBalance: number;
  repaidAmount: number;
  trustScore: number;
  dailyLimit: number;
}

export interface InvestorDashboardData {
  user: DashboardResponse['user'];
  investments: DashboardResponse['investments'];
  totalEarned: number;
  totalInvested: number;
}

export interface AgentDashboardData {
  user: DashboardResponse['user'];
  tasks: DashboardResponse['tasks'];
  totalCollected: number;
  pendingCollections: number;
}

/**
 * Fetch dashboard data for the current user.
 * Returns role-specific data or null on failure.
 */
export async function fetchDashboard(): Promise<
  BorrowerDashboardData | InvestorDashboardData | AgentDashboardData | null
> {
  const user = useAuthStore.getState().user;
  if (!user) return null;

  const result = await apiFetch<DashboardResponse>(
    ENDPOINTS.DASHBOARD(user.id),
  );

  if (!result.success) return null;

  const data = result.data;

  if (data.user.role === 'borrower') {
    const activeLoan = data.activeLoan;
    const repaidAmount =
      data.recentRepayments?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
    return {
      user: data.user,
      activeLoan,
      recentRepayments: data.recentRepayments || [],
      loanBalance: activeLoan?.amount || 8700,
      repaidAmount,
      trustScore: 74,
      dailyLimit: 12000,
    };
  }

  if (data.user.role === 'investor') {
    return {
      user: data.user,
      investments: data.investments || [],
      totalEarned: data.totalEarned || 1455,
      totalInvested:
        data.investments?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0,
    };
  }

  if (data.user.role === 'agent') {
    return {
      user: data.user,
      tasks: data.tasks || [],
      totalCollected: 0,
      pendingCollections: data.tasks?.length || 0,
    };
  }

  return null;
}
