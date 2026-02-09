import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCheck, XCircle } from "lucide-react";
import { ATTENDANCE_STATUS } from "@/lib/constants";

interface BulkActionsProps {
  studentCount: number;
  onMarkAll: (status: "present" | "absent") => void;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
}

const BulkActions = ({ studentCount, onMarkAll, presentCount, lateCount, absentCount, excusedCount }: BulkActionsProps) => {
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onMarkAll(ATTENDANCE_STATUS.PRESENT as "present")}
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark All Present
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onMarkAll(ATTENDANCE_STATUS.ABSENT as "absent")}
          >
            <XCircle className="w-4 h-4 mr-2" />
            Mark All Absent
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded">Present: {presentCount}</span>
          <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded">Late: {lateCount}</span>
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded">Absent: {absentCount}</span>
          {excusedCount > 0 && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">Excused: {excusedCount}</span>
          )}
          <span className="ml-auto text-muted-foreground">Total: {studentCount}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default BulkActions;
