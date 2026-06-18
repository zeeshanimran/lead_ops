export type Role = 'SUPER_ADMIN' | 'BD' | 'CLOSER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type JobStatus = 'NOT_APPLIED' | 'APPLIED';
export type LeadStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'DISMISSED' | 'SCHEDULED' | 'ACTIVE' | 'CLOSED';
export type ManualInviteStatus =
  | 'MANUAL_INVITE_PENDING'
  | 'MANUAL_INVITE_CREATED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'REMINDER_DUE'
  | 'RED_ALERT';

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
  techStack: string;
  payrate: string;
  proofType: 'EMAIL_LINK' | 'SCREENSHOT' | 'MANUAL_VERIFICATION';
  proofNotes?: string;
  proofUrl?: string;
  approvalNotes?: string;
  dismissalReason?: string;
  status: LeadStatus;
  manualInviteStatus: ManualInviteStatus;
  manualInviteLink?: string;
  inviteNotes?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  bd?: User;
  closer?: User;
  job?: Job;
  feedback?: Feedback[];
};

export type Feedback = {
  id: string;
  leadId: string;
  callStatus: 'TAKEN' | 'RESCHEDULED' | 'NO_SHOW' | 'SHIFTED';
  callStage: 'SCREENING' | 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'FIFTH' | 'FINAL' | 'OFFERED';
  nature:
    | 'PHONE_SCREENING'
    | 'FIRST_INTERVIEW'
    | 'TECHNICAL_ROUND'
    | 'PANEL_INTERVIEW'
    | 'CULTURE_FIT'
    | 'FINAL_PANEL'
    | 'OFFER_CALL';
  payrateDiscussed: string;
  importantNotes: string;
  createdAt: string;
};
