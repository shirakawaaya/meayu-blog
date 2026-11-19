import type { siteConfig } from '../../siteConfig';

/**
 * 设置页各分区共用的 props 形状。
 * formData 是站点配置的表单态：初始只含常用字段，其余字段在拉取后端配置后合并进来，
 * 因此用 Partial 包裹；同时保留索引签名，允许表单读写配置里的其余键。
 */
export type SettingsFormData = Omit<Partial<typeof siteConfig>, 'bgImages'> & {
  bgImages?: string[];
} & Record<string, unknown>;

export interface SettingsSectionProps {
  formData: SettingsFormData;
  handleUpdate: (field: string, value: unknown) => void;
  pushToQueue: (label: string, key?: string, value?: unknown) => void;
}
