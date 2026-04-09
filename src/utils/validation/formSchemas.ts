import { z } from 'zod';

const emailSchema = z.string().trim().min(1, 'Email is required').email('Invalid email address');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().trim().min(1, 'Password is required'),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required'),
  studentId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^SE\d{6}$/, 'Student ID must be SE followed by 6 digits (e.g. SE123456)'),
  email: emailSchema,
  password: z
    .string()
    .trim()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/\d/, 'Password must include at least one number'),
});

export const addMemberSchema = z.object({
  userId: z.string().trim().uuid('User ID must be a valid UUID'),
});

export const enrollmentKeySchema = z.object({
  enrollmentKey: z.string().trim().min(1, 'Enrollment key is required'),
});

export const createRepoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Repository name is required')
    .regex(/^[A-Za-z0-9_-]+$/, 'Repository name can only contain letters, numbers, hyphens, and underscores'),
  description: z.string().trim().min(1, 'Repository description is required'),
});

export const groupFormSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required'),
  project_name: z.string().trim().min(1, 'Project name is required'),
  description: z.string().trim().min(1, 'Description is required'),
  semester: z.string().trim().min(1, 'Semester is required'),
  github_repo_url: z.string().trim().min(1, 'GitHub repository is required').url('GitHub URL is invalid'),
  jira_project_key: z
    .string()
    .trim()
    .min(1, 'Jira project key is required')
    .regex(/^[A-Z][A-Z0-9-]*$/, 'Jira project key format is invalid'),
});

export const documentSubmissionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  documentUrl: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^https?:\/\//i.test(value), 'Document URL is invalid'),
  reference: z.string().trim().optional(),
  changeSummary: z.string().trim().optional(),
  contentMarkdown: z.string().optional(),
});

export const topicGenerateSchema = z.object({
  seedName: z.string().trim().min(1, 'Seed topic is required'),
  projectDomain: z.string().trim().min(1, 'Project domain is required'),
  teamContext: z.string().trim().min(1, 'Team context is required'),
  problemSpace: z.string().trim().min(1, 'Problem space is required'),
  primaryActorsHint: z.string().trim().min(1, 'Primary actors hint is required'),
});

export const evaluationSchema = z.object({
  title: z.string().trim().min(1, 'Evaluation title is required'),
  description: z.string().trim().min(1, 'Evaluation description is required'),
  totalPercent: z
    .number()
    .refine((value) => Math.abs(value - 100) <= 0.05, 'Contributions must total 100%'),
});

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required'),
  description: z.string().trim().min(1, 'Task description is required'),
  dueDate: z.string().trim().min(1, 'Due date is required'),
  assigneeId: z.string().trim().min(1, 'Assignee is required'),
});

export const getZodErrorMessage = (error: z.ZodError): string => {
  return error.issues[0]?.message || 'Invalid form input';
};
