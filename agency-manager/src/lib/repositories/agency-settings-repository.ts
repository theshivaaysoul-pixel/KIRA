import type { IAgencySettingsRepository } from './types';
import type { AgencySettings } from '@/lib/types/domain';
import { DEFAULT_AGENCY_SETTINGS } from '@/lib/types/domain';
import { AgencySettingsSchema } from '@/lib/validation';
import type { IStorageService } from '@/lib/storage/storage-service';
import { DataSafetyService } from '@/lib/storage/data-safety-service';
import { DataIntegrityError, ValidationError } from './base-json-repository';

export class AgencySettingsRepository implements IAgencySettingsRepository {
  private readonly storagePath = 'database/settings.json';
  private readonly safetyService: DataSafetyService;

  constructor(private readonly storage: IStorageService) {
    this.safetyService = new DataSafetyService(this.storage);
  }

  async getSettings(): Promise<AgencySettings> {
    try {
      const result = await this.safetyService.safeReadJson(
        this.storagePath,
        AgencySettingsSchema,
        DEFAULT_AGENCY_SETTINGS
      );
      return result.data;
    } catch (err) {
      throw new DataIntegrityError(`Unable to read settings at ${this.storagePath}`, err);
    }
  }

  async updateSettings(data: Partial<AgencySettings>): Promise<AgencySettings> {
    const current = await this.getSettings();
    const merged = {
      ...current,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    const validation = AgencySettingsSchema.safeParse(merged);
    if (!validation.success) {
      const details = validation.error.issues.map((i) => `${i.path.join('.') || 'field'}: ${i.message}`).join(', ');
      throw new ValidationError(`Validation failed updating agency settings: ${details}`, validation.error.issues);
    }

    await this.saveSettings(validation.data);
    return validation.data;
  }

  private async saveSettings(settings: AgencySettings): Promise<void> {
    try {
      await this.safetyService.safeWriteJson({
        storagePath: this.storagePath,
        data: settings,
        schema: AgencySettingsSchema,
        reason: 'BEFORE_UPDATE',
        createBackupBeforeWrite: true,
      });
    } catch (err) {
      throw new DataIntegrityError(`Failed saving settings: ${String(err)}`, err);
    }
  }
}
