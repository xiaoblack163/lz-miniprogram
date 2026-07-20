import { api } from '../../utils/api';
import { resolveImage } from '../../utils/request';

Page({
  data: {
    newsList: [] as any[],
    loading: true,
  },

  onLoad() {
    this.loadNews();
  },

  async loadNews() {
    this.setData({ loading: true });
    try {
      const list = await api.getNewsList();
      const processed = list.map((n: any) => ({
        ...n,
        displayImage: resolveImage(n.displayImage),
      }));
      this.setData({ newsList: processed, loading: false });
    } catch (err) {
      console.error('Failed to load news:', err);
      this.setData({ loading: false });
    }
  },

  onNewsTap(e: any) {
    const { id } = e.currentTarget.dataset;
    my.navigateTo({ url: `/pages/news/detail/detail?id=${id}` });
  },
});
