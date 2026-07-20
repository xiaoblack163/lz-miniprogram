import { api } from '../../utils/api';
import { resolveImage } from '../../utils/request';

Page({
  data: {
    clue: {} as any,
    clueId: '',
    leadInfoList: [] as { label: string; value: string }[],
    reviewStatusText: '',
    reviewStatusClass: '',
  },

  onLoad(query: any) {
    const id = query.id;
    if (id) {
      this.setData({ clueId: id });
      this.loadClue(id);
    }
  },

  async loadClue(id: string) {
    try {
      const clue = await api.getClue(id);
      const leadInfoList = this.parseLeadInfo(clue.leadInfo);
      const reviewStatusText = this.getReviewStatusText(clue.reviewStatus);
      const reviewStatusClass = this.getReviewStatusClass(clue.reviewStatus);
      this.setData({ clue, leadInfoList, reviewStatusText, reviewStatusClass });
    } catch (err) {
      console.error('Failed to load clue:', err);
      my.showToast({ content: '加载详情失败', type: 'none' });
    }
  },

  parseLeadInfo(leadInfo: any): { label: string; value: string }[] {
    if (!leadInfo || typeof leadInfo !== 'object') return [];

    // 按优先级排列：从 leadInfo 中取第一个存在的 key
    // 姓名和手机号已在预约信息中单独展示，此处只展示扩展字段
    const displayFields: { label: string; keys: string[] }[] = [
      { label: '省份',     keys: ['provinceName', 'province'] },
      { label: '城市',     keys: ['cityName', 'city'] },
      { label: '经销商',   keys: ['dealerName', 'dealer', 'merchant_name'] },
      { label: '车型',     keys: ['carModelName', 'carModel'] },
    ];

    const result: { label: string; value: string }[] = [];
    for (const field of displayFields) {
      for (const key of field.keys) {
        const value = leadInfo[key];
        if (value !== undefined && value !== null && value !== '') {
          result.push({ label: field.label, value: String(value) });
          break;
        }
      }
    }
    return result.filter(f => f.value && f.value !== '无' && f.value !== 'null');
  },

  async onReUploadAgreement() {
    try {
      const res = await new Promise<any>((resolve, reject) => {
        my.chooseImage({
          count: 1,
          success: resolve,
          fail: reject,
        });
      });
      if (!res || !res.filePaths || res.filePaths.length === 0) return;
      const filePath = res.filePaths[0];

      my.showLoading({ content: '上传中...' });

      try {
        await api.updateAgreement(this.data.clueId, filePath);
        my.hideLoading();
        my.showToast({ content: '上传成功' });
        this.loadClue(this.data.clueId);
      } catch {
        my.hideLoading();
        my.showToast({ content: '上传失败', type: 'none' });
      }
    } catch {
      // User cancelled
    }
  },

  async onClaimBenefit() {
    my.showLoading({ content: '领取中...' });
    try {
      await api.claimBenefit(this.data.clueId);
      my.hideLoading();
      my.showToast({ content: '权益领取成功' });
      this.loadClue(this.data.clueId);
    } catch (err: any) {
      my.hideLoading();
      const msg = err.errorMessage || err.message || '领取失败';
      my.showToast({ content: msg, type: 'none' });
    }
  },

  onPreviewFile(e: any) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      my.downloadFile({
        url: resolveImage(url),
        success: (res: any) => {
          my.openDocument({ filePath: res.filePath, fileType: 'pdf' });
        },
        fail: () => {
          my.showToast({ content: '文件预览失败', type: 'none' });
        },
      });
    }
  },

  getReviewStatusText(status: string) {
    const map: Record<string, string> = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已驳回',
    };
    return map[status] || '待审核';
  },

  getReviewStatusClass(status: string) {
    const map: Record<string, string> = {
      pending: 'status-pending',
      approved: 'status-approved',
      rejected: 'status-rejected',
    };
    return map[status] || 'status-pending';
  },
});
