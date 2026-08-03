import { api } from '../../utils/api';
import { resolveImage } from '../../utils/request';

Page({
  data: {
    news: {} as any,
    loading: true,
  },

  onLoad(query: any) {
    const id = query.id;
    if (id) {
      this.loadNews(id);
    }
  },

  async loadNews(id: string) {
    this.setData({ loading: true });
    try {
      const detail = await api.getNewsDetail(id);
      if (detail) {
        detail.displayImage = resolveImage(detail.displayImage);
        detail.contentImage = resolveImage(detail.contentImage);
      }
      this.setData({ news: detail, loading: false });
    } catch (err) {
      console.error('Failed to load news detail:', err);
      this.setData({ loading: false });
      my.showToast({ content: '加载失败', type: 'none' });
    }
  },
});
