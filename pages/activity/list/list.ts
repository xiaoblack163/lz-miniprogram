import { api } from '../../utils/api';
import { resolveImage } from '../../utils/request';

Page({
  data: {
    activities: [] as any[],
    loading: true,
  },

  onLoad() {
    this.loadActivities();
  },

  async loadActivities() {
    this.setData({ loading: true });
    try {
      const list = await api.getActivities();
      const processed = list.map((a: any) => ({
        ...a,
        headImage: Array.isArray(a.headImage)
          ? a.headImage.map((url: string) => resolveImage(url))
          : resolveImage(a.headImage),
      }));
      this.setData({ activities: processed, loading: false });
    } catch (err) {
      console.error('Failed to load activities:', err);
      this.setData({ loading: false });
    }
  },

  onActivityTap(e: any) {
    const { code } = e.currentTarget.dataset;
    if (code) {
      my.navigateTo({ url: `/pages/activity/detail/detail?code=${code}` });
    }
  },
});
