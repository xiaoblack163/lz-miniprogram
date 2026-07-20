Component({
  props: {
    list: {
      type: Array,
      default: [],
    },
    activeIndex: {
      type: Number,
      default: 0,
    },
  },

  data: {
    current: 0,
  },

  didMount() {
    this.setData({ current: this.props.activeIndex || 0 });
  },

  methods: {
    onItemTap(e: any) {
      const { index, link } = e.currentTarget.dataset;
      if (!link) return;
      // 不切换 current 状态，反正页面即将跳走
      my.navigateTo({ url: link });
    },
  },
});
