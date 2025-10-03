import { get } from "svelte/store";
import dayjs from "dayjs";

import type {
  DataField,
  DataRecord,
  DataValue,
  Optional,
} from "./dataframe/dataframe";
import type { DataApi } from "./dataApi";
import { dataFrame } from "./stores/dataframe";
import { settings } from "./stores/settings";
import type { DataSource } from "./datasources";
import type { IFileSystem } from "./filesystem/filesystem";

/**
 * ViewApi provides an write API for views.
 */
export class ViewApi {
  constructor(readonly dataSource: DataSource, readonly dataApi: DataApi, readonly fileSystem: IFileSystem) {}

  private async logStatusChange(oldStatus: any, newStatus: any, logPath: string, fileName: string) {
    try {
      const currentDate = dayjs().format('YYYY-MM-DD');
      const currentTime = dayjs().format('HH:mm:ss');
      
      // Determine the actual log file path
      const actualLogPath = logPath ? `${logPath}/project-log.md` : 'project-log.md';
      
      // Check if log file exists
      const logFile = this.fileSystem.getFile(actualLogPath);
      
      let existingContent = '';
      if (logFile) {
        try {
          existingContent = await logFile.read();
        } catch (error) {
          // File exists but couldn't read it, start with empty content
          existingContent = '';
        }
      }
      
      // Create log entry with file name in Obsidian link format
      const logEntry = `[[${fileName}]],${currentDate},${currentTime},${oldStatus || 'null'},${newStatus || 'null'}\n`;
      const newContent = existingContent + logEntry;
      
      // Write to log file
      if (logFile) {
        await logFile.write(newContent);
      } else {
        // Create new file
        await this.fileSystem.create(actualLogPath, newContent);
      }
    } catch (error) {
      console.error('Failed to log status change:', error);
    }
  }

  addRecord(record: DataRecord, fields: DataField[], templatePath: string) {
    if (this.dataSource.includes(record.id)) {
      dataFrame.addRecord(record);
    }
    this.dataApi.createNote(record, fields ?? [], templatePath);
  }

  async updateRecord(record: DataRecord, fields: DataField[]) {
    // Check if status field has changed and state tracking is enabled
    const currentSettings = get(settings);
    if (currentSettings.preferences.enableStateTracking) {
      const currentDataFrame = get(dataFrame);
      const existingRecord = currentDataFrame.records.find(r => r.id === record.id);
      
      if (existingRecord && record.values['status'] !== existingRecord.values['status']) {
        console.log("status changed!");
        
        // Log the status change to file
        const oldStatus = existingRecord.values['status'];
        const newStatus = record.values['status'];
        const logPath = currentSettings.preferences.logPath;
        
        // Extract file name from record ID (file path)
        const fileName = record.id.split('/').pop()?.replace(/\.md$/, '') || record.id;
        
        await this.logStatusChange(oldStatus, newStatus, logPath, fileName);
      }
    }
    
    if (this.dataSource.includes(record.id)) {
      dataFrame.updateRecord(record);
    }
    this.dataApi.updateRecord(fields, record);
  }


  async updateRecords(records: DataRecord[], fields: DataField[]) {
    // Check if status field has changed for any record and state tracking is enabled
    const currentSettings = get(settings);
    if (currentSettings.preferences.enableStateTracking) {
      const currentDataFrame = get(dataFrame);
      const logPath = currentSettings.preferences.logPath;
      
      for (const record of records) {
        const existingRecord = currentDataFrame.records.find(r => r.id === record.id);
        if (existingRecord && record.values['status'] !== existingRecord.values['status']) {
          console.log("status changed!");
          
          // Log the status change to file
          const oldStatus = existingRecord.values['status'];
          const newStatus = record.values['status'];
          
          // Extract file name from record ID (file path)
          const fileName = record.id.split('/').pop()?.replace(/\.md$/, '') || record.id;
          
          await this.logStatusChange(oldStatus, newStatus, logPath, fileName);
        }
      }
    }
    
    const rs = records.filter((r) => this.dataSource.includes(r.id));
    if (rs) dataFrame.updateRecords(rs);
    await this.dataApi.updateRecords(fields, records);
  }

  deleteRecord(recordId: string) {
    if (this.dataSource.includes(recordId)) {
      dataFrame.deleteRecord(recordId);
    }
    this.dataApi.deleteRecord(recordId);
  }

  addField(field: DataField, value: Optional<DataValue>, position?: number) {
    dataFrame.addField(field, position);

    this.dataApi.addField(
      get(dataFrame).records.map((record) => record.id),
      field,
      value
    );
  }

  updateField(field: DataField, oldName?: string) {
    dataFrame.updateField(field, oldName);

    if (oldName) {
      this.dataApi.renameField(
        get(dataFrame).records.map((record) => record.id),
        oldName,
        field.name
      );
    }
  }

  deleteField(field: string) {
    dataFrame.deleteField(field);
    this.dataApi.deleteField(
      get(dataFrame).records.map((record) => record.id),
      field
    );
  }
}
