 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
 } from "@/components/ui/dialog";
 import { useToast } from "@/hooks/use-toast";
 import { supabase } from "@/integrations/supabase/client";
 import { Upload, CheckCircle, XCircle, AlertCircle, Loader2, GraduationCap } from "lucide-react";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Badge } from "@/components/ui/badge";
 import { Progress } from "@/components/ui/progress";
 
 interface TeacherData {
   full_name: string;
   email: string;
 }
 
 interface ImportResult {
   email: string;
   status: "success" | "error" | "exists";
   message: string;
 }
 
 // Teacher list from the PDF
 const TEACHERS_DATA: TeacherData[] = [
   { full_name: "Alina Herzog", email: "alina.herzog@ntare-louisenlund.org" },
   { full_name: "Alphonse Maniraguha", email: "alphonse.maniraguha@ntare-louisenlund.org" },
   { full_name: "Bhatia Sakshi", email: "bhatia.sakshi@ntare-louisenlund.org" },
   { full_name: "Caleb. O. Asiso", email: "caleb.asiso@ntare-louisenlund.org" },
   { full_name: "Christoph Nikolaus Frickhinger", email: "christoph.frickhinger@ntare-louisenlund.org" },
   { full_name: "Damien Paul Vassallo", email: "damien.vassallo@ntare-louisenlund.org" },
   { full_name: "David Nishimwe", email: "david.nishimwe@ntare-louisenlund.org" },
   { full_name: "David Niyitegeka", email: "david.niyitegeka@ntare-louisenlund.org" },
   { full_name: "Davis Omondi", email: "davis.omondi@ntare-louisenlund.org" },
   { full_name: "Edagbo Oke Blessing", email: "edagbo.blessing@ntare-louisenlund.org" },
   { full_name: "Emily Kremenic", email: "emily.kremenic@ntare-louisenlund.org" },
   { full_name: "Emma Doellefeld", email: "emma.doellefeld@ntare-louisenlund.org" },
   { full_name: "Francine Mukankusi", email: "francine.mukankusi@ntare-louisenlund.org" },
   { full_name: "Gloria Mutoni", email: "gloria.mutoni@ntare-louisenlund.org" },
   { full_name: "Irene Gashagaza", email: "irene.gashagaza@ntare-louisenlund.org" },
   { full_name: "Jaclin Paul", email: "jaclin.paul@ntare-louisenlund.org" },
   { full_name: "Jean Marie Vianney Mbarushimana", email: "jean.mbarushimana@ntare-louisenlund.org" },
   { full_name: "Jean De Dieu Murenzi", email: "jean.murenzi@ntare-louisenlund.org" },
   { full_name: "Jean Paul Nyabyenda", email: "jean.nyabyenda@ntare-louisenlund.org" },
   { full_name: "Jes'ka Washington", email: "jes.washington@ntare-louisenlund.org" },
   { full_name: "Joseph Hake", email: "joe.hake@ntare-louisenlund.org" },
   { full_name: "Kaspar Wassenberg", email: "kaspar.wassenberg@ntare-louisenlund.org" },
   { full_name: "Katharina Mudahemuka", email: "katharina.mudahemuka@ntare-louisenlund.org" },
   { full_name: "Kathleen Lyn Challenor", email: "kathleen.challenor@ntare-louisenlund.org" },
   { full_name: "Kennedy Koja", email: "kennedy.koja@ntare-louisenlund.org" },
   { full_name: "Kruedenscheidt Karl-Heinz", email: "kruedenscheidt.karl@ntare-louisenlund.org" },
   { full_name: "Linnet Chebet", email: "linnet.chebet@ntare-louisenlund.org" },
   { full_name: "Lisa Rucyaha", email: "lisa.rucyaha@ntare-louisenlund.org" },
   { full_name: "Mauritz Viljoen", email: "mauritz.viljoen@ntare-louisenlund.org" },
   { full_name: "Mildred Nabunje", email: "mildred.nabunje@ntare-louisenlund.org" },
   { full_name: "Patrick Guevara Muhire", email: "patrick.muhire@ntare-louisenlund.org" },
   { full_name: "Pho Vu", email: "pho.vu@ntare-louisenlund.org" },
   { full_name: "Pierre Niyibigira", email: "pierre.niyibigira@ntare-louisenlund.org" },
   { full_name: "Piotr Tomaszczuk", email: "piotr-tomaszczuk@ntare-louisenlund.org" },
   { full_name: "Pontien Ntirenganya", email: "pontien.ntirenganya@ntare-louisenlund.org" },
   { full_name: "Praveen Rana", email: "praveen.rana@ntare-louisenlund.org" },
   { full_name: "Robert Grace Tugume", email: "robert.tugume@ntare-louisenlund.org" },
   { full_name: "Ryan James Jeram", email: "ryan.james@ntare-louisenlund.org" },
   { full_name: "Scovia Kabanyana", email: "scovia.kabanyana@ntare-louisenlund.org" },
   { full_name: "Sebastian Wagner", email: "sebastian.wagner@ntare-louisenlund.org" },
   { full_name: "Solange Uwiduhaye", email: "solange.uwiduhaye@ntare-louisenlund.org" },
   { full_name: "Stacy Hill", email: "stacy.hill@ntare-louisenlund.org" },
   { full_name: "Svenja Budziak", email: "svenja.budziak@ntare-louisenlund.org" },
   { full_name: "Usama Elkashef", email: "usama.elkashef@ntare-louisenlund.org" },
  { full_name: "Welford McLellan Jr", email: "welford.mclellan@ntare-louisenlund.org" },
  { full_name: "Ayako Seo", email: "ayako.seo@ntare-louisenlund.org" },
  { full_name: "Alain Mugisha", email: "mugisha.alain@ntare-louisenlund.org" },
  { full_name: "Baptist Semanaza", email: "semanaza.baptist@ntare-louisenlund.org" },
  { full_name: "Noella Dushake", email: "noella.dushake@ntare-louisenlund.org" },
  { full_name: "Clement Tuyisenge", email: "clement.tuyisenge@ntare-louisenlund.org" },
  { full_name: "Aimable Ndayishimiye", email: "aimable.ndayishimiye@ntare-louisenlund.org" },
  { full_name: "Eric Ndatimana", email: "eric.ndatimana@ntare-louisenlund.org" },
  { full_name: "Simon Cyuzuzo", email: "simon.cyuzuzo@ntare-louisenlund.org" },
  { full_name: "Joyce Ndatimana", email: "joyce.ndatimana@ntare-louisenlund.org" },
];
 
 interface TeacherBulkImportProps {
   onComplete: () => void;
 }
 
 const TeacherBulkImport = ({ onComplete }: TeacherBulkImportProps) => {
   const { toast } = useToast();
   const [isOpen, setIsOpen] = useState(false);
   const [isImporting, setIsImporting] = useState(false);
   const [progress, setProgress] = useState(0);
   const [results, setResults] = useState<ImportResult[]>([]);
   const [showResults, setShowResults] = useState(false);
 
   const handleImport = async () => {
     if (!confirm(`This will attempt to send invite emails to ${TEACHERS_DATA.length} teachers. Continue?`)) {
       return;
     }
 
     setIsImporting(true);
     setProgress(0);
     setResults([]);
     setShowResults(false);
 
     const importResults: ImportResult[] = [];
     const batchSize = 5;
 
     for (let i = 0; i < TEACHERS_DATA.length; i += batchSize) {
       const batch = TEACHERS_DATA.slice(i, i + batchSize);
       
       const batchPromises = batch.map(async (teacher) => {
         try {
           const { data, error } = await supabase.functions.invoke("import-teachers", {
             body: { 
               email: teacher.email, 
               full_name: teacher.full_name 
             },
           });
 
           if (error) {
             return {
               email: teacher.email,
               status: "error" as const,
               message: error.message || "Failed to create account",
             };
           }
 
           if (data?.exists) {
             return {
               email: teacher.email,
               status: "exists" as const,
               message: "Account already exists",
             };
           }
 
           return {
             email: teacher.email,
             status: "success" as const,
             message: "Invite sent successfully",
           };
         } catch (err: any) {
           return {
             email: teacher.email,
             status: "error" as const,
             message: err.message || "Unknown error",
           };
         }
       });
 
       const batchResults = await Promise.all(batchPromises);
       importResults.push(...batchResults);
       
       setProgress(Math.round((importResults.length / TEACHERS_DATA.length) * 100));
       
       if (i + batchSize < TEACHERS_DATA.length) {
         await new Promise(resolve => setTimeout(resolve, 500));
       }
     }
 
     setResults(importResults);
     setShowResults(true);
     setIsImporting(false);
 
     const successCount = importResults.filter(r => r.status === "success").length;
     const existsCount = importResults.filter(r => r.status === "exists").length;
     const errorCount = importResults.filter(r => r.status === "error").length;
 
     toast({
       title: "Import Complete",
       description: `${successCount} invited, ${existsCount} already exist, ${errorCount} failed`,
     });
 
     if (successCount > 0) {
       onComplete();
     }
   };
 
   const getStatusIcon = (status: ImportResult["status"]) => {
     switch (status) {
       case "success":
         return <CheckCircle className="h-4 w-4 text-primary" />;
       case "exists":
         return <AlertCircle className="h-4 w-4 text-secondary" />;
       case "error":
         return <XCircle className="h-4 w-4 text-destructive" />;
     }
   };
 
   const getStatusBadge = (status: ImportResult["status"]) => {
     switch (status) {
       case "success":
         return <Badge className="bg-primary/10 text-primary border-primary/20">Invited</Badge>;
       case "exists":
         return <Badge variant="secondary">Exists</Badge>;
       case "error":
         return <Badge variant="destructive">Failed</Badge>;
     }
   };
 
   const successCount = results.filter(r => r.status === "success").length;
   const existsCount = results.filter(r => r.status === "exists").length;
   const errorCount = results.filter(r => r.status === "error").length;
 
   return (
     <Dialog open={isOpen} onOpenChange={setIsOpen}>
       <DialogTrigger asChild>
         <Button variant="outline">
           <GraduationCap className="h-4 w-4 mr-2" />
           Import Teachers
         </Button>
       </DialogTrigger>
       <DialogContent className="max-w-2xl">
         <DialogHeader>
           <DialogTitle>Bulk Import Teachers</DialogTitle>
           <DialogDescription>
             Import {TEACHERS_DATA.length} teachers from the uploaded member list. 
             Each teacher will receive an email invitation to set their password and will be assigned the teacher role.
           </DialogDescription>
         </DialogHeader>
 
         {!showResults ? (
           <div className="py-4">
             {isImporting ? (
               <div className="space-y-4">
                 <div className="flex items-center gap-2">
                   <Loader2 className="h-4 w-4 animate-spin" />
                   <span>Importing teachers... {progress}%</span>
                 </div>
                 <Progress value={progress} />
               </div>
             ) : (
               <div className="space-y-4">
                 <div className="bg-muted/50 rounded-lg p-4">
                   <h4 className="font-medium mb-2">Preview</h4>
                   <p className="text-sm text-muted-foreground mb-3">
                     First 5 teachers to be imported:
                   </p>
                   <div className="space-y-2">
                     {TEACHERS_DATA.slice(0, 5).map((teacher, idx) => (
                       <div key={idx} className="text-sm flex justify-between">
                         <span>{teacher.full_name}</span>
                         <span className="text-muted-foreground">{teacher.email}</span>
                       </div>
                     ))}
                     <div className="text-sm text-muted-foreground pt-2">
                       ... and {TEACHERS_DATA.length - 5} more
                     </div>
                   </div>
                 </div>
               </div>
             )}
           </div>
         ) : (
           <div className="py-4 space-y-4">
             <div className="flex gap-4">
               <div className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-primary" />
                 <span className="text-sm">{successCount} invited</span>
               </div>
               <div className="flex items-center gap-2">
                 <AlertCircle className="h-4 w-4 text-secondary" />
                 <span className="text-sm">{existsCount} existing</span>
               </div>
               <div className="flex items-center gap-2">
                 <XCircle className="h-4 w-4 text-destructive" />
                 <span className="text-sm">{errorCount} failed</span>
               </div>
             </div>
 
             <ScrollArea className="h-[300px] border rounded-lg">
               <div className="p-4 space-y-2">
                 {results.map((result, idx) => (
                   <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                     <div className="flex items-center gap-2">
                       {getStatusIcon(result.status)}
                       <span className="text-sm">{result.email}</span>
                     </div>
                     {getStatusBadge(result.status)}
                   </div>
                 ))}
               </div>
             </ScrollArea>
           </div>
         )}
 
         <DialogFooter>
           {!showResults ? (
             <>
               <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isImporting}>
                 Cancel
               </Button>
               <Button onClick={handleImport} disabled={isImporting}>
                 {isImporting ? (
                   <>
                     <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                     Importing...
                   </>
                 ) : (
                   <>
                     <Upload className="h-4 w-4 mr-2" />
                     Start Import
                   </>
                 )}
               </Button>
             </>
           ) : (
             <Button onClick={() => {
               setIsOpen(false);
               setShowResults(false);
               setResults([]);
             }}>
               Close
             </Button>
           )}
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 };
 
 export default TeacherBulkImport;