import { api } from '../utils/api';
import { resolveImage } from '../utils/request';

Page({
  data: {
    banners: [] as any[],
    activities: [] as any[],
    hotNews: [] as any[],
    adSlot: null as any,
    loading: true,
    menuList: [] as any[],
    activeMenuIndex: 0,
  },

  onLoad() {
    this.loadHomepageConfig();
  },

  onShow() {
    // 页面显示时刷新（不重新拉取，保持已有数据）
  },

  onPullDownRefresh() {
    this.loadHomepageConfig();
    my.stopPullDownRefresh();
  },

  async loadHomepageConfig() {
    this.setData({ loading: true });
    try {
      const config = await api.getHomepageConfig();
      const banners = (config.banners || []).map((b: any) => ({
        ...b,
        imageUrl: resolveImage(b.imageUrl),
      }));
      const activities = (config.hotActivities || []).map((a: any) => ({
        ...a,
        displayImage: resolveImage(a.displayImage),
        headImage: resolveImage(a.headImage),
        bgImage: resolveImage(a.bgImage),
      }));
      const hotNews = (config.hotNews || []).map((n: any) => ({
        ...n,
        displayImage: resolveImage(n.displayImage),
        contentImage: resolveImage(n.contentImage),
      }));
      const menuList = (config.bottomMenus || []).map((m: any) => ({
        ...m,
        icon: resolveImage(m.icon),
      }));
      const adSlot = config.adSlot
        ? { ...config.adSlot, imageUrl: resolveImage(config.adSlot.imageUrl) }
        : null;

      this.setData({
        banners,
        activities,
        hotNews,
        adSlot,
        menuList,
        loading: false,
      });
    } catch (err) {
      console.error('Failed to load homepage config:', err);
      this.setData({ loading: false });
    }
  },

  onActivityTap(e: any) {
    const code = e.currentTarget.dataset.code;
    my.navigateTo({ url: `/pages/activity/detail/detail?code=${code}` });
  },

  onBannerTap(e: any) {
    const { linkUrl, enableJump } = e.currentTarget.dataset;
    if (enableJump && linkUrl) {
      my.navigateTo({ url: `/${linkUrl}` });
    }
  },

  onAdTap(e: any) {
    const { linkUrl } = e.currentTarget.dataset;
    if (linkUrl) {
      if (linkUrl.startsWith('http')) {
        // 外链用 web-view
        my.navigateTo({ url: `/pages/webview/webview?url=${encodeURIComponent(linkUrl)}` });
      } else {
        my.navigateTo({ url: linkUrl });
      }
    }
  },

  onNewsTap(e: any) {
    const { index } = e.currentTarget.dataset;
    const news = this.data.hotNews[index];
    if (news) {
      my.navigateTo({ url: `/pages/news/detail/detail?id=${news._id}` });
    }
  },

  onNewsMore() {
    my.navigateTo({ url: '/pages/news/list/list' });
  },

  onMenuTap(e: any) {
    const { index, link } = e.detail;
    this.setData({ activeMenuIndex: index });
    if (link) {
      my.redirectTo({ url: link });
    }
  },
});
