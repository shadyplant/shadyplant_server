const { query } = require("../config/postgres");

const mapRuntimeSettingRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    key: row.setting_key,
    value: row.setting_value || {},
    updatedByStaffAccountId: row.updated_by_staff_account_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const findRuntimeSettingByKey = async (settingKey) => {
  const result = await query(
    "SELECT * FROM app_runtime_settings WHERE setting_key = $1 LIMIT 1",
    [settingKey],
  );

  return mapRuntimeSettingRow(result.rows[0]);
};

const upsertRuntimeSetting = async ({
  key,
  value,
  updatedByStaffAccountId = null,
}) => {
  const result = await query(
    `INSERT INTO app_runtime_settings (
      setting_key,
      setting_value,
      updated_by_staff_account_id,
      created_at,
      updated_at
    ) VALUES ($1, $2::jsonb, $3, NOW(), NOW())
    ON CONFLICT (setting_key)
    DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      updated_by_staff_account_id = EXCLUDED.updated_by_staff_account_id,
      updated_at = NOW()
    RETURNING *`,
    [key, JSON.stringify(value || {}), updatedByStaffAccountId],
  );

  return mapRuntimeSettingRow(result.rows[0]);
};

module.exports = {
  findRuntimeSettingByKey,
  upsertRuntimeSetting,
};
