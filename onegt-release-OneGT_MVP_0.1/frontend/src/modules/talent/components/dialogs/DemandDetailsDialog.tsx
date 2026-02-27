import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Users, Calendar, Briefcase, Edit2, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DemandDetailsDialogProps {
  demand: Demand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'view' | 'edit';
  onSave?: (demand: Demand) => void;
  onClose?: (demandId: string) => void;
}

const statusColors = {
  open: 'bg-success/10 text-success border-success/20',
  closed: 'bg-muted text-muted-foreground border-border',
  on_hold: 'bg-warning/10 text-warning border-warning/20',
};

const isValidDate = (d: any) => {
  return d instanceof Date && !isNaN(d.getTime());
};

export const DemandDetailsDialog = ({
  demand,
  open,
  onOpenChange,
  mode,
  onSave,
  onClose
}: DemandDetailsDialogProps) => {
  const [isEditing, setIsEditing] = useState(mode === 'edit');
  const [editData, setEditData] = useState<Demand | null>(demand);

  // Sync state with props when dialog opens or demand changes
  useEffect(() => {
    if (open) {
      setIsEditing(mode === 'edit');
      setEditData(demand);
    }
  }, [open, demand, mode]);

  if (!demand) return null;

  const handleSave = () => {
    if (!editData) return;
    onSave?.(editData);
    toast.success('Demand updated successfully!');
    setIsEditing(false);
    onOpenChange(false);
  };

  const handleClose = () => {
    onClose?.(demand.id);
    toast.success('Position closed successfully!');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{isEditing ? 'Edit Demand' : 'Demand Details'}</DialogTitle>
            {!isEditing && mode !== 'edit' && (
              <Button variant="ghost" size="sm" onClick={() => {
                setEditData(demand);
                setIsEditing(true);
              }}>
                <Edit2 className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        {isEditing ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input
                value={editData?.title || ''}
                onChange={(e) => setEditData(prev => prev ? { ...prev, title: e.target.value } : null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Experience</Label>
                <Input
                  value={editData?.experience || ''}
                  onChange={(e) => setEditData(prev => prev ? { ...prev, experience: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={editData?.location || ''}
                  onChange={(e) => setEditData(prev => prev ? { ...prev, location: e.target.value } : null)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Openings</Label>
                <Input
                  type="number"
                  value={editData?.openings || ''}
                  onChange={(e) => setEditData(prev => prev ? { ...prev, openings: parseInt(e.target.value) } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editData?.status || 'open'}
                  onValueChange={(value: 'open' | 'closed' | 'on_hold') =>
                    setEditData(prev => prev ? { ...prev, status: value } : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Skills (comma separated)</Label>
              <Textarea
                value={editData?.skills?.join(', ') || ''}
                onChange={(e) => setEditData(prev => prev ? {
                  ...prev,
                  skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                } : null)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                Save Changes
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold">{demand.title}</h3>
                <p className="text-muted-foreground">{demand.role}</p>
              </div>
              <Badge className={cn('border', statusColors[demand.status])}>
                {demand.status === 'on_hold' ? 'On Hold' : demand.status.charAt(0).toUpperCase() + demand.status.slice(1)}
              </Badge>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{demand.location || 'Not Specified'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{demand.experience || 'Not Specified'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{demand.openings || 0} Openings</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{demand.createdAt ? (isValidDate(new Date(demand.createdAt)) ? format(new Date(demand.createdAt), 'MMM d, yyyy') : 'Invalid Date') : 'No Date'}</span>
              </div>
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Required Skills</Label>
              <div className="flex flex-wrap gap-2">
                {(demand.skills || []).length > 0 ? (
                  demand.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">{skill}</Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic">No skills listed</span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{demand.applicants}</p>
                <p className="text-sm text-muted-foreground">Applied</p>
              </div>
              <div className="text-center border-x">
                <p className="text-2xl font-bold text-foreground">{demand.interviewed}</p>
                <p className="text-sm text-muted-foreground">Interviewed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">{demand.offers}</p>
                <p className="text-sm text-muted-foreground">Offers</p>
              </div>
            </div>

            {/* Created By */}
            <div className="text-sm text-muted-foreground">
              Created by <span className="font-medium text-foreground">{demand.createdBy}</span>
            </div>

            {demand.status === 'open' && (
              <DialogFooter>
                <Button variant="destructive" onClick={handleClose}>
                  Close Position
                </Button>
              </DialogFooter>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
