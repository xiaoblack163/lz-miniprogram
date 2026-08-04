import { api } from '../../utils/api';
import { resolveImage } from '../../utils/request';
import { isLogin, getUserInfo, setToken, setUserInfo } from '../../utils/auth';

interface FormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  dictCode?: string;
  sort?: number;
}

Page({
  data: {
    step: 'form' as 'form' | 'upload' | 'agreement' | 'done',
    activity: {} as any,
    formFields: [] as FormField[],
    formData: {} as Record<string, any>,
    formError: '',
    submitting: false,
    privacyAgreed: false,
    phoneAuthed: false,
    loading: true,
    phoneLoading: false,
    // 提交后保留的关键信息（用于协议回填）
    submittedPhone: '',
    // Protocol
    agreementUrl: '',
    agreementFileName: '',
    uploadSubmitting: false,
    agreed: false,
    agreementSubmitting: false,
    // Select picker
    showPicker: false,
    pickerOptions: [] as string[],
    pickerFieldKey: '',
    // 参与检查
    hasParticipated: false,
    previousLead: null as any,
    checking: false,
    // 静默登录持有的 userId（同 storage 同步）
    userId: '',
  },

  onLoad(query: any) {
    const code = query.code || query._id;
    // 把 storage 里已有的 userId 同步到 page data，便于 onPhoneAuth 直接使用
    const cachedUserId = (getUserInfo() as any)?.userId || '';
    if (cachedUserId) {
      this.setData({ userId: cachedUserId });
    }
    if (code) {
      this.loadActivity(code);
    }
  },

  // 静默登录（获取 userId + token，不弹窗）
  async silentLogin() {
    // 已有 token + userId 才跳过；只 token 没 userId 也强制重登一次
    const cached = getUserInfo() as any;
    if (isLogin() && cached?.userId) return;
    try {
      const authResult: any = await new Promise((resolve, reject) => {
        my.getAuthCode({
          scopes: 'auth_base',
          success: (res: any) => resolve(res),
          fail: (err: any) => reject(err),
        });
      });
      const result: any = await api.authCodeLogin(authResult.authCode);
      const token = result?.token;
      const userId = result?.userId;
      if (token) setToken(token);
      if (userId) {
        // 持久化到 storage，onPhoneAuth 才能读到 userId
        setUserInfo({ userId, ...(cached || {}) });
        this.setData({ userId });
        console.log('[silentLogin] 静默登录成功 userId:', userId);
      } else {
        console.log('[silentLogin] 后端未返回 userId，原始返回:', JSON.stringify(result));
      }
    } catch (err: any) {
      console.log('[silentLogin] 静默登录失败:', err?.errorMessage || err?.message || err);
    }
  },

  async loadActivity(code: string) {
    this.setData({ loading: true });
    try {
      const result = await api.getActivityDetail(code);
      const activity = result.activity || result;
      // 将字典数据挂到 activity 上，供 onSelectTap 使用
      activity.dictionaries = result.dictionaries || {};
      const fields = (activity.formFields || []).sort((a: FormField, b: FormField) => (a.sort || 0) - (b.sort || 0));

      // 处理头图（数组或单图统一转为数组）
      if (Array.isArray(activity.headImage) && activity.headImage.length > 0) {
        activity.headImage = activity.headImage.map((url: string) => resolveImage(url));
      } else if (activity.headImage && typeof activity.headImage === 'string') {
        activity.headImage = [resolveImage(activity.headImage)];
      }
      // 处理底图
      if (Array.isArray(activity.bgImage) && activity.bgImage.length > 0) {
        activity.bgImage = activity.bgImage.map((url: string) => resolveImage(url));
      } else if (activity.bgImage && typeof activity.bgImage === 'string') {
        activity.bgImage = [resolveImage(activity.bgImage)];
      }
      if (activity.displayImage) activity.displayImage = resolveImage(activity.displayImage);

      // 已登录用户自动填手机号
      const initFormData: Record<string, any> = {};
      if (isLogin()) {
        const userInfo = getUserInfo();
        const phoneField = fields.find(f => f.key === 'phone' || f.key === 'mobile');
        if (phoneField && userInfo?.phone) {
          initFormData[phoneField.key] = userInfo.phone;
        }
      }

      this.setData({
        activity,
        formFields: fields,
        formData: initFormData,
        phoneAuthed: !!initFormData[fields.find(f => f.key === 'phone' || f.key === 'mobile')?.key || ''],
      });

      // 自动填充手机号和定位
      this.autoFillFormData(fields, activity);

      // 加载完成后检查参与状态
      this.checkPreviousParticipation(activity);
    } catch (err) {
      console.error('Failed to load activity:', err);
      my.showToast({ content: '加载活动失败', type: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 检查用户是否已参与过当前活动
   * - 未参与 → 保持空白表单
   * - 已参与 + 无协议上传需求 → 显示历史数据
   * - 已参与 + 需上传协议但未传 → 跳到上传步骤（续传）
   * - 已参与 + 需上传协议且已传 → 跳到完成页
   */
  async checkPreviousParticipation(activity: any) {
    if (!isLogin()) return;

    const userInfo = getUserInfo();
    if (!userInfo?.phone) return;

    this.setData({ checking: true });
    try {
      const res = await api.checkActivityParticipation(activity.code, userInfo.phone);
      if (!res.participated) return;

      const lead = res.lead;
      this.setData({ hasParticipated: true, previousLead: lead });

      if (activity.protocolUploadEnabled) {
        if (!lead?.agreementUrl) {
          // 已提交表单但未上传协议 → 跳到上传步骤
          this.setData({ step: 'upload', submittedPhone: lead?.phone || userInfo.phone });
        } else {
          // 协议也已上传 → 完成
          this.setData({ step: 'done' });
        }
      }
      // 无协议上传需求 → 保持在 form 步骤，顶部显示历史数据
    } catch (err) {
      console.error('checkParticipation failed:', err);
      // 静默失败，不影响正常使用
    } finally {
      this.setData({ checking: false });
    }
  },

  // ====== 表单输入 ======
  onFieldInput(e: any) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    this.setData({
      [`formData.${key}`]: value,
      formError: '',
    });
  },

  onSelectTap(e: any) {
    const key = e.currentTarget.dataset.key;
    const field = this.data.formFields.find(f => f.key === key);
    if (!field) return;

    let items: { label: string; value: string }[] = [];
    // 如果有 dictCode，从 dictionaries 数据中获取选项
    if (field.dictCode && this.data.activity.dictionaries) {
      const dictItems = this.data.activity.dictionaries[field.dictCode] || [];

      if (field.dictCode === 'city') {
        // 城市字段级联：根据已选省份过滤
        const selectedProvince = this.data.formData['province'];
        const provinceVal = selectedProvince && selectedProvince.value
          ? selectedProvince.value
          : selectedProvince;
        if (provinceVal) {
          items = dictItems
            .filter((item: any) => item.parentValue === provinceVal)
            .map((item: any) => ({ label: item.label, value: item.value }));
        }
        if (!provinceVal) {
          this.setData({ [`formData.${key}`]: '' });
          my.showToast({ content: '请先选择省份', type: 'none' });
          return;
        }
      } else if (field.dictCode === 'dealer') {
        // 经销商字段级联：根据已选城市的 label（中文名）过滤
        const selectedCity = this.data.formData['city'];
        const cityVal = selectedCity && selectedCity.label
          ? selectedCity.label
          : (selectedCity && selectedCity.value ? selectedCity.value : selectedCity);
        if (cityVal) {
          items = dictItems
            .filter((item: any) => item.parentValue === cityVal)
            .map((item: any) => ({ label: item.label, value: item.value }));
        }
        if (!cityVal) {
          this.setData({ [`formData.${key}`]: '' });
          my.showToast({ content: '请先选择城市', type: 'none' });
          return;
        }
      } else {
        items = dictItems.map((item: any) => ({ label: item.label, value: item.value }));
      }
    } else if (field.options && field.options.length > 0) {
      // 无 dictCode，使用 options 数组
      items = field.options.map((opt: string) => ({ label: opt, value: opt }));
    }

    if (items.length === 0) {
      return;
    }

    my.showActionSheet({
      title: `请选择${field.label}`,
      items: items.map(i => i.label),
      success: (res: any) => {
        if (res.index !== undefined && items[res.index]) {
          const selected = items[res.index];
          this.setData({
            [`formData.${key}`]: { label: selected.label, value: selected.value },
            formError: '',
          });
          // 如果选择了省份，清空城市和经销商
          if (field.dictCode === 'province') {
            this.setData({ 'formData.city': '', 'formData.dealer': '' });
          }
          // 如果选择了城市，清空经销商
          if (field.dictCode === 'city') {
            this.setData({ 'formData.dealer': '' });
          }
        }
      },
    });
  },

  onUploadField(e: any) {
    const key = e.currentTarget.dataset.key;
    my.chooseImage({
      count: 1,
      success: (res: any) => {
        if (res.filePaths && res.filePaths[0]) {
          this.setData({
            [`formData.${key}`]: res.filePaths[0],
            formError: '',
          });
        }
      },
    });
  },

  // ====== 手机号授权 ======
  // 用户点击授权按钮并同意后触发（来自 open-type="getAuthorize"）
  async onGetPhoneAuth() {
    console.log('[phoneAuth] onGetPhoneAuth 触发');
    if (this.data.phoneLoading) return;
    this.setData({ phoneLoading: true });
    my.showLoading({ content: '授权中...' });

    try {
      // 1. 确保有 userId + token
      await this.silentLogin();
      const userId = this.data.userId || (getUserInfo() as any)?.userId || '';
      if (!userId) {
        throw new Error('未获取到用户身份，请重试');
      }
      console.log('[phoneAuth] userId 已就绪:', userId);

      // 2. 调 my.getPhoneNumber 拿加密 response（用户已同意授权场景下会成功）
      const encryptedData: string = await new Promise((resolve, reject) => {
        my.getPhoneNumber({
          success: (res: any) => {
            let data = res?.response;
            try {
              const parsed = JSON.parse(data);
              data = parsed?.response || data;
            } catch {}
            if (data) resolve(data);
            else reject(new Error('未拿到加密数据'));
          },
          fail: (err: any) => reject(new Error(err?.errorMessage || '获取手机号失败')),
        });
      });
      console.log('[phoneAuth] encryptedData 长度:', encryptedData?.length);

      // 3. 后端用 userId + 加密数据解密出手机号
      const result: any = await api.phoneLogin(userId, encryptedData);
      const phone = result?.userInfo?.mobile || result?.mobile || '';
      if (!phone) throw new Error('后端未返回手机号');

      // 4. 写入表单 + storage
      const { formFields } = this.data as any;
      const phoneField = formFields.find((f: any) => f.key === 'phone' || f.key === 'mobile');
      if (phoneField) {
        this.setData({ [`formData.${phoneField.key}`]: phone, phoneAuthed: true });
      }
      setUserInfo({ userId, phone, ...(getUserInfo() as any) });
      my.hideLoading();
      this.setData({ phoneLoading: false });
      console.log('[phoneAuth] 手机号已填入:', phone);
    } catch (err: any) {
      my.hideLoading();
      this.setData({ phoneLoading: false });
      console.error('[phoneAuth] 失败:', err);
      my.showToast({ content: err?.errorMessage || err?.message || '授权失败', type: 'none' });
    }
  },

  // 用户拒绝授权时触发
  handlePhoneAuthError(e: any) {
    console.error('[phoneAuth] 用户拒绝授权:', e?.detail);
    this.setData({ phoneLoading: false });
    my.showToast({ content: '已取消授权', type: 'none' });
  },

  // ====== 提交表单 ======
  async onSubmit() {
    const { formFields, formData, activity } = this.data;

    // 校验隐私协议
    if (!this.data.privacyAgreed) {
      this.setData({ formError: '请先阅读并同意隐私保护协议' });
      return;
    }

    // 未登录先静默登录
    if (!isLogin()) {
      try {
        await this.silentLogin();
      } catch {
        // 静默登录失败不阻塞提交
      }
    }

    // 校验必填字段（固定值字段不需要校验）
    for (const field of formFields) {
      if (field.type === 'fixed') continue;
      if (field.required && !formData[field.key]) {
        this.setData({ formError: `请填写${field.label}` });
        return;
      }
    }

    this.setData({ submitting: true, formError: '' });

    try {
      // 提取字典选项的 value（formData 中存的是 { label, value } 对象）
      const submitData: Record<string, any> = {};

      // 固定值字段：自动填充
      for (const field of formFields) {
        if (field.type === 'fixed' && field.fixedValue) {
          submitData[field.key] = field.fixedValue;
        }
      }

      for (const key of Object.keys(formData)) {
        const val = formData[key];
        if (val && typeof val === 'object' && val.value !== undefined) {
          submitData[key] = val.value;
        } else {
          submitData[key] = val;
        }
      }

      await api.submitActivityForm({
        activityCode: activity.code,
        formData: { ...submitData, source: 'alipay_shijia' },
      });

      // 保留关键信息用于后续协议回填
      this.setData({ submittedPhone: submitData.phone || '' });

      if (activity.protocolUploadEnabled) {
        // 需要上传协议
        this.setData({ step: 'upload', submitting: false });
      } else {
        this.setData({ step: 'done', submitting: false });
      }
    } catch (err: any) {
      this.setData({ submitting: false });
      console.log(err, '111')
      my.showToast({ content: err.message || '提交失败', type: 'none' });
    }
  },

  // ====== 协议上传 ======
  async onUploadAgreement() {
    try {
      const res = await (my as any).chooseImage({ count: 1 });
      if (res.filePaths && res.filePaths[0]) {
        const filePath = res.filePaths[0];
        my.showLoading({ content: '上传中...' });
        const url = await (api as any).uploadFile(filePath);
        my.hideLoading();
        this.setData({
          agreementUrl: url,
          agreementFileName: filePath.split('/').pop() || '协议文件',
        });
      }
    } catch (err: any) {
      if (err.error !== 10) {
        my.hideLoading();
        my.showToast({ content: '上传失败', type: 'none' });
      }
    }
  },

  onUploadNext() {
    if (!this.data.agreementUrl) return;
    this.setData({ step: 'agreement' });
  },

  // ====== 协议确认 ======
  onToggleAgreed() {
    this.setData({ agreed: !this.data.agreed });
  },

  async onAgreementConfirm() {
    const { agreed, agreementUrl, activity, submittedPhone } = this.data;
    if (!agreed || !agreementUrl) return;
    this.setData({ agreementSubmitting: true });

    try {
      // 回填协议链接到已提交的表单记录
      await api.submitActivityAgreement({
        activityCode: activity.code,
        phone: submittedPhone,
        agreementUrl,
      });
      this.setData({ step: 'done', agreementSubmitting: false });
    } catch {
      this.setData({ agreementSubmitting: false });
      my.showToast({ content: '协议提交失败，请重试', type: 'none' });
    }
  },

  // ====== 自动填充 ======
  autoFillFormData(fields: FormField[], activity: any) {
    const autoData: Record<string, any> = {};

    // 自动填手机号
    const phoneField = fields.find(f => f.key === 'phone' || f.key === 'mobile');
    console.log('[autoFill] 手机号字段:', phoneField?.key, '登录状态:', isLogin());
    if (phoneField && isLogin()) {
      const userInfo = getUserInfo();
      console.log('[autoFill] 用户信息:', JSON.stringify(userInfo));
      const phone = userInfo?.phone || userInfo?.mobile;
      if (phone) {
        autoData[phoneField.key] = phone;
        console.log('[autoFill] 填入手机号:', phone);
      } else {
        console.log('[autoFill] 用户信息中无手机号');
      }
    }

    // 自动定位：获取当前城市省份
    const provinceField = fields.find(f => f.key === 'province');
    const cityField = fields.find(f => f.key === 'city');
    if (provinceField || cityField) {
      this.fillLocationFromGPS(autoData, provinceField, cityField, activity);
    }

    if (Object.keys(autoData).length > 0) {
      this.setData({ formData: autoData });
    }
  },

  fillLocationFromGPS(
    autoData: Record<string, any>,
    provinceField: FormField | undefined,
    cityField: FormField | undefined,
    activity: any,
  ) {
    console.log('[autoFill] 开始获取定位...');
    // type=1: 获取经纬度 + 省市区县逆地理编码（支付宝内置，无需高德API）
    my.getLocation({
      type: 1,
      success: (locRes: any) => {
        console.log('[autoFill] 定位成功:', JSON.stringify(locRes));
        const formData: Record<string, any> = { ...this.data.formData, ...autoData };

        if (provinceField && locRes.province) {
          formData[provinceField.key] = locRes.province;
          console.log('[autoFill] 填入省份:', locRes.province);
        }
        if (cityField && locRes.city) {
          // 城市字段是级联的，需要匹配字典中的选项
          const cityDict = activity.dictionaries?.city || [];
          // 直辖市：支付宝定位返回 city 为省份名（如"北京市"），字典里存的是区名（如"东城区"）
          // 此时用省份名匹配，并传给经销商筛选
          const isDirectCity = locRes.city === locRes.province;
          const cityName = isDirectCity ? locRes.province : locRes.city;
          const matched = cityDict.find((c: any) => c.label === cityName || c.label.includes(cityName));
          console.log('[autoFill] 城市匹配:', { city: cityName, matched: !!matched, isDirectCity, dictCount: cityDict.length });
          if (matched) {
            formData[cityField.key] = { label: matched.label, value: matched.value };
          } else {
            // 直辖市没匹配到区也填省份名
            formData[cityField.key] = cityName;
          }
        }

        // 如果有经销商字段，选中当前城市的第一个经销商
        const dealerField = (this.data.formFields as FormField[]).find(f => f.key === 'dealer' || f.key === 'dealerName');
        if (dealerField && locRes.city) {
          const dealerDict = activity.dictionaries?.dealer || [];
          // 直辖市用省份名匹配经销商 parentValue
          const dealerCity = locRes.city === locRes.province ? locRes.province : locRes.city;
          const matchedDealers = dealerDict.filter((d: any) =>
            d.parentValue === dealerCity || d.parentValue.includes(dealerCity)
          );
          if (matchedDealers.length > 0) {
            formData[dealerField.key] = { label: matchedDealers[0].label, value: matchedDealers[0].value };
            console.log('[autoFill] 自动选中经销商:', matchedDealers[0].label);
          }
        }

        this.setData({ formData });
      },
      fail: (err: any) => {
        console.log('[autoFill] 定位失败:', JSON.stringify(err));
      },
    });
  },

  // ====== 隐私协议 ======
  onPrivacyChange(e: any) {
    this.setData({ privacyAgreed: e.detail.value });
  },

  onPrivacyTap() {
    my.navigateTo({ url: '/pages/activity/privacy/privacy' });
  },

  // ====== 完成 ======
  onBack() {
    my.reLaunch({ url: '/pages/index/index' });
  },
});
