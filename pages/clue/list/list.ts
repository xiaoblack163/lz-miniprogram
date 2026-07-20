import { api } from '../../utils/api';
import { isLogin, clearToken } from '../../utils/auth';

Page({
  data: {
    clues: [] as any[],
    filteredClues: [] as any[],
    loading: true,
    filterStatus: 'all' as string,
    notLoggedIn: false,
  },

  onShow() {
    if (!isLogin()) {
      this.setData({ notLoggedIn: true, loading: false, clues: [], filteredClues: [] });
      my.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({ notLoggedIn: false });
    this.loadClues();
  },

  onPullDownRefresh() {
    this.loadClues().finally(() => {
      my.stopPullDownRefresh();
    });
  },

  async loadClues() {
    this.setData({ loading: true });
    try {
      const clues = await api.getClues();
      // 预计算状态文本和样式，避免模板中调用方法失败
      const statusMap: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已驳回' };
      const classMap: Record<string, string> = { pending: 'tag-pending', approved: 'tag-approved', rejected: 'tag-rejected' };
      const benefitTextMap: Record<string, string> = { unclaimed: '未领取', claimed: '已领取' };
      const benefitClassMap: Record<string, string> = { unclaimed: 'tag-none', claimed: 'tag-claimed' };
      const mapped = (clues || []).map((c: any) => ({
        ...c,
        _reviewStatusText: statusMap[c.reviewStatus] || '待审核',
        _reviewStatusClass: classMap[c.reviewStatus] || 'tag-pending',
        _benefitStatusText: benefitTextMap[c.benefitClaimStatus] || c.benefitClaimStatus || '未领取',
        _benefitStatusClass: benefitClassMap[c.benefitClaimStatus] || 'tag-none',
      }));
      this.setData({ clues: mapped, loading: false });
      this.applyFilter();
    } catch (err: any) {
      console.error('Failed to load clues:', err);
      const msg = err?.message || '';
      if (msg.includes('登录已过期') || msg.includes('Unauthorized')) {
        clearToken();
        this.setData({ notLoggedIn: true, loading: false, clues: [], filteredClues: [] });
        // 直接跳转登录页
        my.reLaunch({ url: '/pages/login/login' });
      } else {
        this.setData({ loading: false });
        my.showToast({ content: '加载失败', type: 'none' });
      }
    }
  },

  onFilterTap(e: any) {
    const status = e.currentTarget.dataset.status;
    this.setData({ filterStatus: status });
    this.applyFilter();
  },

  applyFilter() {
    const { clues, filterStatus } = this.data;
    if (filterStatus === 'all') {
      this.setData({ filteredClues: clues });
    } else {
      this.setData({
        filteredClues: clues.filter((c: any) => c.reviewStatus === filterStatus),
      });
    }
  },

  onClueTap(e: any) {
    const id = e.currentTarget.dataset.id;
    my.navigateTo({ url: `/pages/clue/detail/detail?id=${id}` });
  },

  onJumpActivity(e: any) {
    const code = e.currentTarget.dataset.code;
    if (code) {
      my.navigateTo({ url: `/pages/activity/detail/detail?code=${code}` });
    }
  },

  onGoLogin() {
    my.navigateTo({ url: '/pages/login/login' });
  },
});
