import { useState } from 'react';
import { Demand } from '@/types/recruitment';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useUsers } from '@/context/UsersContext';
import { useRecruitment } from '@/context/RecruitmentContext';

const replacePlaceholders = (template: string, data: Record<string, string>) => {
  let result = template;
  Object.entries(data).forEach(([key, value]) => {
    // Escape special characters for regex
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\[${escapedKey}\\]`, 'g'), value);
  });
  return result;
};

interface CreateDemandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate?: (demand: Omit<Demand, 'id' | 'createdAt' | 'applicants' | 'interviewed' | 'offers'>) => void;
}

export const CreateDemandDialog = ({ open, onOpenChange, onCreate }: CreateDemandDialogProps) => {
  const { users } = useUsers();
  const { emailTemplates, sendEmail } = useRecruitment();
  const [formData, setFormData] = useState({
    title: '',
    role: '',
    experience: '',
    location: '',
    openings: 1,
    skills: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.experience || !formData.location) {
      toast.error('Please fill in all required fields');
      return;
    }

    const newDemand = {
      title: formData.title,
      role: formData.role || formData.title,
      experience: formData.experience,
      location: formData.location,
      openings: formData.openings,
      skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
      status: 'open' as const,
      createdBy: 'Current User',
      rejected: 0,
    };

    // Send email notifications to admin and super admin
    const adminUsers = users.filter(user =>
      user.role === 'admin' || user.role === 'super_admin'
    );

    adminUsers.forEach(user => {
      const template = emailTemplates.find(t => t.id === 'demand_created');
      let emailSubject = '📢 New Job Demand Created';
      let emailBody = '';

      if (template) {
        const pData = {
          'User Name': user.name,
          'Title': newDemand.title,
          'Role': newDemand.role,
          'Experience': newDemand.experience,
          'Location': newDemand.location,
          'Openings': newDemand.openings.toString(),
          'Status': newDemand.status.toUpperCase(),
          'Created By': newDemand.createdBy,
          'Created At': new Date().toLocaleString(),
          'Skills': newDemand.skills.join(', '),
          'HireFlow Dashboard Link': 'https://hireflow.app/demands',
          'Admin Portal Link': 'https://hireflow.app/admin',
        };
        emailSubject = replacePlaceholders(template.subject, pData);
        emailBody = replacePlaceholders(template.body, pData);
      } else {
        // Fallback
        emailBody = `
📢 New Job Demand Created

Dear ${user.name},

A new job demand has been created...
        `;
      }

      if (user.email) {
        sendEmail(user.email, emailSubject, emailBody.replace(/\n/g, '<br>'))
          .then(() => console.log(`Email sent to ${user.email}`))
          .catch(err => console.error(`Failed to send email to ${user.email}`, err));
      }
    });

    // Post to company career page
    console.log(`Posted to career page: ${newDemand.title}`);
    // In a real app, this would integrate with your career page CMS or API

    onCreate?.(newDemand);
    toast.success('Demand created successfully!');
    toast.info(`Job posted on career page: ${newDemand.title}`);
    onOpenChange(false);

    // Reset form
    setFormData({
      title: '',
      role: '',
      experience: '',
      location: '',
      openings: 1,
      skills: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Demand</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Job Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Senior DevOps Engineer"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Input
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              placeholder="e.g., DevOps Engineer"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Experience *</Label>
              <Input
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                placeholder="e.g., 5-8 years"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Location *</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Bangalore"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Number of Openings</Label>
            <Input
              type="number"
              min={1}
              value={formData.openings}
              onChange={(e) => setFormData({ ...formData, openings: parseInt(e.target.value) || 1 })}
            />
          </div>

          <div className="space-y-2">
            <Label>Required Skills (comma separated)</Label>
            <Textarea
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              placeholder="e.g., AWS, Kubernetes, Docker, Terraform"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Demand</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
