export type Role = 'SUPER_ADMIN' | 'BD' | 'CLOSER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type JobStatus = 'NOT_APPLIED' | 'APPLIED';
export type LeadStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'READY_TO_SCHEDULE'
  | 'CALL_SCHEDULED'
  | 'IN_PROGRESS'
  | 'NEXT_CALL_REQUIRED'
  | 'OFFERED'
  | 'REJECTED'
  | 'CLOSED'
  | 'DISMISSED';
export type LeadCallStatus = 'SCHEDULED' | 'COMPLETED' | 'PENDING_FEEDBACK' | 'NO_SHOW' | 'RESCHEDULED' | 'CANCELLED';
export type ManualInviteStatus = 'MANUAL_INVITE_PENDING' | 'MANUAL_INVITE_CREATED' | 'ACCEPTED' | 'DECLINED' | 'REMINDER_DUE';
export type CallStage = 'SCREENING' | 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'FIFTH' | 'FINAL' | 'OFFERED';
export type FeedbackCallStatus = 'TAKEN' | 'RESCHEDULED' | 'NO_SHOW' | 'SHIFTED';
export type FeedbackResult = 'PASSED' | 'FAILED' | 'NEED_NEXT_CALL' | 'OFFERED' | 'REJECTED' | 'NO_DECISION';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
};

export type TechStack = {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
};

export type Job = {
  id: string;
  jobId: string;
  dateAdded: string;
  platform: string;
  companyName: string;
  techStack: string;
  jobLink: string;
  jobDescription: string;
  status: JobStatus;
  bd?: User;
};

export type Lead = {
  id: string;
  companyName: string;
  profileName: string;
  resumeUrl?: string;
  nature: 'W2' | 'CONTRACT' | 'C2C';
  techStackId: string;
  techStack?: TechStack;
  payrate: string;
  proofType: 'EMAIL_LINK' | 'SCREENSHOT' | 'MANUAL_VERIFICATION';
  proofNotes?: string;
  proofUrl?: string;
  adminNotes?: string;
  dismissalReason?: string;
  status: LeadStatus;
  currentStage?: CallStage;
  approvedAt?: string;
  createdByBd?: User;
  assignedBd?: User;
  approvedByAdmin?: User;
  job?: Job;
  calls?: LeadCall[];
  timeline?: LeadTimeline[];
};

export type LeadCall = {
  id: string;
  leadId: string;
  callNumber: number;
  callStage: CallStage;
  scheduledAt: string;
  status: LeadCallStatus;
  manualInviteStatus: ManualInviteStatus;
  manualInviteLink?: string;
  bdNotes?: string;
  closerNotes?: string;
  scheduledByBd?: User;
  closer?: User;
  lead?: Lead;
  feedback?: CallFeedback[];
};

export type CallFeedback = {
  id: string;
  leadCallId: string;
  closerId: string;
  callStatus: FeedbackCallStatus;
  result: FeedbackResult;
  comments: string;
  payrateDiscussed: string;
  nextAction?: string;
  nextCallRequired: boolean;
  createdAt: string;
  closer?: User;
};

export type LeadTimeline = {
  id: string;
  leadId: string;
  actorId?: string;
  action: string;
  description: string;
  createdAt: string;
  actor?: User;
};
