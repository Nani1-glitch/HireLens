import { JobApplication } from '../types';

const STORAGE_KEY = 'hirelens_applications';

export const getApplications = (): JobApplication[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading applications:', error);
    return [];
  }
};

export const saveApplication = (application: JobApplication): void => {
  try {
    const applications = getApplications();
    const existingIndex = applications.findIndex(app => app.id === application.id);
    
    if (existingIndex >= 0) {
      applications[existingIndex] = application;
    } else {
      applications.push(application);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
  } catch (error) {
    console.error('Error saving application:', error);
  }
};

export const deleteApplication = (id: string): void => {
  try {
    const applications = getApplications();
    const filtered = applications.filter(app => app.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting application:', error);
  }
};

export const createApplication = (
  jobTitle: string,
  company: string,
  jobDescription: string
): JobApplication => {
  return {
    id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    jobTitle,
    company,
    jobDescription,
    appliedDate: new Date().toISOString(),
    status: 'applied',
  };
};

export const updateApplicationStatus = (
  id: string,
  status: JobApplication['status'],
  interviewDate?: string,
  followUpDate?: string
): void => {
  const applications = getApplications();
  const app = applications.find(a => a.id === id);
  
  if (app) {
    app.status = status;
    if (interviewDate) app.interviewDate = interviewDate;
    if (followUpDate) app.followUpDate = followUpDate;
    saveApplication(app);
  }
};

