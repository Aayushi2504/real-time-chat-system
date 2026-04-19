export const JOB_TYPES = {
  PROCESS_NOTIFICATION: 'PROCESS_NOTIFICATION',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

export type ProcessNotificationPayload = {
  notificationId: string;
  /** When true, worker throws to exercise retry + DLQ (tests / demo) */
  forceFail?: boolean;
};

export type QueueJobPayloadMap = {
  [JOB_TYPES.PROCESS_NOTIFICATION]: ProcessNotificationPayload;
};
