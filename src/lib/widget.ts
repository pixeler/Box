import { AppStorage } from './storage';

export interface WidgetData {
  todayTaskCount: number;
  doneTaskCount: number;
  focusMinutesToday: number;
  nextTaskTitle: string;
  lastUpdated: number;
}

export async function syncWidgetData(data: Partial<WidgetData>): Promise<void> {
  try {
    const existingRaw = await AppStorage.get('widget_data');
    let merged: WidgetData = {
      todayTaskCount: 0,
      doneTaskCount: 0,
      focusMinutesToday: 0,
      nextTaskTitle: '',
      lastUpdated: Date.now(),
    };

    if (existingRaw) {
      try {
        merged = { ...merged, ...JSON.parse(existingRaw) };
      } catch {
        // ignore parse error
      }
    }

    merged = {
      ...merged,
      ...data,
      lastUpdated: Date.now(),
    };

    await AppStorage.set('widget_data', JSON.stringify(merged));
  } catch (error) {
    console.warn('[Widget] Failed to sync widget data:', error);
  }
}
