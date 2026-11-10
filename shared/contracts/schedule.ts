/**
 * Schedule / EPG contract.
 * Shared between all CTV platforms for schedule display and DVR.
 */

export type ScheduleProvider = 'mock' | 'server';

export interface ScheduleProgram {
  id: string;
  title: string;
  channelName: string;
  start: string;
  end: string;
  description: string;
  category?: string;
}

export interface ScheduleChannel {
  id: string;
  name: string;
}

export interface Schedule {
  channelSchedule?: Record<string, ScheduleProgram[]>;
  channelNames?: Record<string, string>;
  channelOrder?: string[];
}

export interface ScheduleEvent {
  type: 'now' | 'upcoming' | 'end' | 'changed' | 'error';
  programId: string;
  channelName: string;
  title: string;
  start?: string;
  end?: string;
  description?: string;
  category?: string;
  error?: string;
}

export interface Reminder {
  programId: string;
  title: string;
  channelName: string;
  start?: string;
  end?: string;
}

export interface RecordProgramResult {
  success: boolean;
  message: string;
}
