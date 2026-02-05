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
 import { Upload, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Badge } from "@/components/ui/badge";
 import { Progress } from "@/components/ui/progress";
 
 interface StudentData {
   full_name: string;
   email: string;
 }
 
 interface ImportResult {
   email: string;
   status: "success" | "error" | "exists";
   message: string;
 }
 
 // Hardcoded student list from the PDF
 const STUDENTS_DATA: StudentData[] = [
   { full_name: "Aime Brice Bana", email: "aime.bana30@ntare-louisenlund.org" },
   { full_name: "Aimee Dasia Kuzo", email: "aimee.kuzo30@ntare-louisenlund.org" },
   { full_name: "Ake Obine Sabine", email: "ake.obine30@ntare-louisenlund.org" },
   { full_name: "Albina Ineza", email: "albina.ineza30@ntare-louisenlund.org" },
   { full_name: "Alexis Tuyizere", email: "alexis.tuyizere30@ntare-louisenlund.org" },
   { full_name: "Aliane Nzanana Byishimo", email: "aliane.nzanana30@ntare-louisenlund.org" },
   { full_name: "Alliance Pacifique Igeno", email: "alliance.igeno30@ntare-louisenlund.org" },
   { full_name: "Alphakeys Bob Ngabonziza", email: "alphakeys.ngabonziza30@ntare-louisenlund.org" },
   { full_name: "Alvin Nkongori", email: "alvin.nkongori30@ntare-louisenlund.org" },
   { full_name: "Ange Delice Masengesho Rukundo", email: "ange.masengesho30@ntare-louisenlund.org" },
   { full_name: "Annel Lisette Ashimwe", email: "annel.ashimwe30@ntare-louisenlund.org" },
   { full_name: "Ariella Igihozo Gatera", email: "ariella.igihozo30@ntare-louisenlund.org" },
   { full_name: "Armand Rugamba Irakoze", email: "armand.rugamba30@ntare-louisenlund.org" },
   { full_name: "Aubella Mugisha Ikirezi", email: "aubella.mugisha30@ntare-louisenlund.org" },
   { full_name: "Aubry Kayiranga Imanzi", email: "aubry.kayiranga30@ntare-louisenlund.org" },
   { full_name: "Axel Shema", email: "axel.shema30@ntare-louisenlund.org" },
   { full_name: "Ayman Nganji", email: "ayman.nganji30@ntare-louisenlund.org" },
   { full_name: "Belinda Teta Isaro", email: "belinda.teta30@ntare-louisenlund.org" },
   { full_name: "Belise Igabe", email: "belise.igabe30@ntare-louisenlund.org" },
   { full_name: "Bellarmin Mizero Roberto", email: "bellarmin.mizero30@ntare-louisenlund.org" },
   { full_name: "Benitha AKARABO", email: "benitha.akarabo30@ntare-louisenlund.org" },
   { full_name: "Blair Allan Nziza", email: "blair.nziza30@ntare-louisenlund.org" },
   { full_name: "Blaise Adelan Imanzi Himbarwa", email: "blaise.imanzi30@ntare-louisenlund.org" },
   { full_name: "Bond Lior Cyizere", email: "bond.cyizere30@ntare-louisenlund.org" },
   { full_name: "Brevado Nziza Bahati", email: "brevado.nziza30@ntare-louisenlund.org" },
   { full_name: "Bright Giraneza", email: "bright.giraneza30@ntare-louisenlund.org" },
   { full_name: "Bright Gisa", email: "bright.gisa30@ntare-louisenlund.org" },
   { full_name: "Briona Tona Murara", email: "briona.tona30@ntare-louisenlund.org" },
   { full_name: "Bronie Igabe Ineza", email: "bronie.igabe30@ntare-louisenlund.org" },
   { full_name: "Bruno Ilan Karera Sangwa", email: "bruno.karera30@ntare-louisenlund.org" },
   { full_name: "Che Bwanungu Kwesiga", email: "che.kwesiga30@ntare-louisenlund.org" },
   { full_name: "Cheidy Agahozo", email: "cheidy.agahozo30@ntare-louisenlund.org" },
   { full_name: "Chrispine Murenzi Hadassah", email: "chrispine.murenzi30@ntare-louisenlund.org" },
   { full_name: "Christella Izere Peace", email: "christella.izere30@ntare-louisenlund.org" },
   { full_name: "Christian Kabahizi Manzi", email: "christian.kabahizi30@ntare-louisenlund.org" },
   { full_name: "Christian Mutuyeyesu Bon fils", email: "christian.mutuyeyesu30@ntare-louisenlund.org" },
   { full_name: "Cliff Niyo", email: "cliff.niyo30@ntare-louisenlund.org" },
   { full_name: "Cyusa Ntwari", email: "cyusa.ntwari30@ntare-louisenlund.org" },
   { full_name: "Daniela Ishimwe", email: "daniella.ishimwe30@ntare-louisenlund.org" },
   { full_name: "Daniella Rukundo", email: "daniella.rukundo30@ntare-louisenlund.org" },
   { full_name: "Daniella Angel Uwayo Shema", email: "daniella.uwayo30@ntare-louisenlund.org" },
   { full_name: "Daryne Ineza Nice", email: "daryne.ineza30@ntare-louisenlund.org" },
   { full_name: "David Hannington Kasoma Zake", email: "david.kasoma30@ntare-louisenlund.org" },
   { full_name: "Davina Nishema Kamikazi", email: "davina.nishema30@ntare-louisenlund.org" },
   { full_name: "Davis Buranga Karemera", email: "davis.buranga30@ntare-louisenlund.org" },
   { full_name: "Davy Kabeja Gabiro", email: "davy.kabeja30@ntare-louisenlund.org" },
   { full_name: "Derry Bizima Ganza", email: "derry.bizimana30@ntare-louisenlund.org" },
   { full_name: "Diallo Ylan Mbanda Raymond Ibrahima", email: "diallo.ylan30@ntare-louisenlund.org" },
   { full_name: "Digne Samantha Sugira", email: "digne.sugira30@ntare-louisenlund.org" },
   { full_name: "Dolie Keza", email: "dolie.keza30@ntare-louisenlund.org" },
   { full_name: "Elvis Irakoze Shami", email: "elvis.irakoze30@ntare-louisenlund.org" },
   { full_name: "Ezra Gashumba iriho", email: "ezra.gashumba30@ntare-louisenlund.org" },
   { full_name: "Fabrice Lucky Igiraneza", email: "fabrice.igiraneza30@ntare-louisenlund.org" },
   { full_name: "Gabin Rugero", email: "gabin.rugero30@ntare-louisenlund.org" },
   { full_name: "Gabriella Ineza Kirezi Kirenga", email: "gabriella.ineza30@ntare-louisenlund.org" },
   { full_name: "Gabriella Isimbi Rwigema", email: "gabriella.isimbi30@ntare-louisenlund.org" },
   { full_name: "Gatsinzi Rudatsimburwa", email: "gatsinzi.rudatsimburwa30@ntare-louisenlund.org" },
   { full_name: "Goretti Mukamana", email: "goretti.mukamana30@ntare-louisenlund.org" },
   { full_name: "Hildegard Frickhinger", email: "hildegard.frickhinger30@ntare-louisenlund.org" },
   { full_name: "Hirwa Chris Hakizimana", email: "hirwa.hakizimana30@ntare-louisenlund.org" },
   { full_name: "Hope Ineza", email: "hope.ineza30@ntare-louisenlund.org" },
   { full_name: "Hubertus Friederich Strumpell", email: "hubertus.strumpell30@ntare-louisenlund.org" },
   { full_name: "Hugo Dax Ruterana", email: "hugo.ruterana30@ntare-louisenlund.org" },
   { full_name: "Hyaw Estifanos", email: "hyaw.estifanos30@ntare-louisenlund.org" },
   { full_name: "Ian Neza", email: "ian.neza30@ntare-louisenlund.org" },
   { full_name: "Ian Ngoga", email: "ian.ngoga30@ntare-louisenlund.org" },
   { full_name: "Ingrid Micomyiza", email: "ingrid.micomyiza30@ntare-louisenlund.org" },
   { full_name: "Irebe Annaelle Ntaganira", email: "irebe.ntaganira30@ntare-louisenlund.org" },
   { full_name: "Iris Louange Kaze", email: "iris.kaze30@ntare-louisenlund.org" },
   { full_name: "Ivan Patrick Iradukunda", email: "ivan.iradukunda30@ntare-louisenlund.org" },
   { full_name: "Ivan Karasira Cyusa", email: "ivan.karasira30@ntare-louisenlund.org" },
   { full_name: "Ivan Lucky Kundwa", email: "ivan.kundwa30@ntare-louisenlund.org" },
   { full_name: "Jacques Ntihemuka", email: "jacques.ntihemuka30@ntare-louisenlund.org" },
   { full_name: "Jean Serge Masengesho Mugisha", email: "jean.masengesho30@ntare-louisenlund.org" },
   { full_name: "Jena Munyurwa", email: "jena.munyurwa30@ntare-louisenlund.org" },
   { full_name: "Jeoffrey Ishimwe Kabandana", email: "jeoffrey.ishimwe30@ntare-louisenlund.org" },
   { full_name: "Jessy Dannick Mugisha", email: "jessy.mugisha30@ntare-louisenlund.org" },
   { full_name: "Joseph Rwamucyo Shimwa", email: "joseph.rwamucyo30@ntare-louisenlund.org" },
   { full_name: "Joshua Hirwa", email: "joshua.hirwa30@ntare-louisenlund.org" },
   { full_name: "Josine Gladys Iganze", email: "josine.iganze30@ntare-louisenlund.org" },
   { full_name: "Joy Bright Iriho", email: "joy.iriho30@ntare-louisenlund.org" },
   { full_name: "Joyce Marie Ange Cyuzuzo", email: "joyce.cyuzuzo30@ntare-louisenlund.org" },
   { full_name: "Joyce Umurungi Giraso", email: "joyce.umurungi30@ntare-louisenlund.org" },
   { full_name: "Joyeuse Mumararungu", email: "joyeuse.mumararungu30@ntare-louisenlund.org" },
   { full_name: "Jules Amini", email: "jules.amini30@ntare-louisenlund.org" },
   { full_name: "Julio Nkeramihigo", email: "julio.nkeramihigo30@ntare-louisenlund.org" },
   { full_name: "Karara Louange Mugirabanga", email: "karara.mugirabanga30@ntare-louisenlund.org" },
   { full_name: "Kelly Hakizimana", email: "kelly.hakizimana30@ntare-louisenlund.org" },
   { full_name: "Kelly Mugisha Hakizuwera", email: "kelly.mugisha30@ntare-louisenlund.org" },
   { full_name: "Kelson Agaba Trevor", email: "kelson.agaba30@ntare-louisenlund.org" },
   { full_name: "Kennedy Kanyamibwa Gakwandi", email: "kennedy.kanyamibwa30@ntare-louisenlund.org" },
   { full_name: "Kethia Igihozo Niyo", email: "kethia.igihozo30@ntare-louisenlund.org" },
   { full_name: "Koen Habumugisha Rey", email: "koen.habumugisha30@ntare-louisenlund.org" },
   { full_name: "Louange Natasha Ingabire", email: "louange.ingabire30@ntare-louisenlund.org" },
   { full_name: "Lucky Ines Ishimwe", email: "lucky.ishimwe30@ntare-louisenlund.org" },
   { full_name: "Manzi Dishime Elvin", email: "manzi.dushime30@ntare-louisenlund.org" },
   { full_name: "Marc Mishako Mukiza", email: "marc.mishako30@ntare-louisenlund.org" },
   { full_name: "Marie Reine Mukeshimana", email: "marie.mukeshimana30@ntare-louisenlund.org" },
   { full_name: "Mary Kelissy Ihirwe", email: "mary.ihirwe30@ntare-louisenlund.org" },
   { full_name: "Michaella Aganze Shimwa", email: "michaella.aganze30@ntare-louisenlund.org" },
   { full_name: "Milly Vanelly Irakoze", email: "milly.irakoze30@ntare-louisenlund.org" },
   { full_name: "Minani David Ineza", email: "minani.ineza30@ntare-louisenlund.org" },
   { full_name: "Nadege Isheja", email: "nadege.isheja30@ntare-louisenlund.org" },
   { full_name: "Nadia Ituze", email: "nadia.ituze30@ntare-louisenlund.org" },
   { full_name: "Nailah Liz Ishema Niyitegeka", email: "nailah.ishema30@ntare-louisenlund.org" },
   { full_name: "Nancy Uwicyeza Munyaneza", email: "nancy.uwicyeza30@ntare-louisenlund.org" },
   { full_name: "Nelly Ishimwe Kwizera", email: "nelly.ishimwe30@ntare-louisenlund.org" },
   { full_name: "Nice Benita Ikirezi", email: "nice.ikirezi30@ntare-louisenlund.org" },
   { full_name: "Nice Manzi", email: "nice.manzi30@ntare-louisenlund.org" },
   { full_name: "Nissi Mbabazi Natukunda", email: "nissi.natukunda30@ntare-louisenlund.org" },
   { full_name: "Norbert Ngoga", email: "norbert.ngoga30@ntare-louisenlund.org" },
   { full_name: "Oscar Landry Berwa", email: "oscar.berwa30@ntare-louisenlund.org" },
   { full_name: "Peace Sheja", email: "peace.sheja30@ntare-louisenlund.org" },
   { full_name: "Precious Neumann Imfurakazi Mary", email: "precious.imfurakazi30@ntare-louisenlund.org" },
   { full_name: "Preston Dushime Ngabo", email: "preston.dushime30@ntare-louisenlund.org" },
   { full_name: "Prince Ganza Sano Glory", email: "prince.ganza30@ntare-louisenlund.org" },
   { full_name: "Queen Deborah Kamikazi", email: "queen.kamikazi30@ntare-louisenlund.org" },
   { full_name: "Rene Nkurunziza", email: "rene.nkurunziza30@ntare-louisenlund.org" },
   { full_name: "Reyna Pascale Sine Mutijima", email: "reyna.sine30@ntare-louisenlund.org" },
   { full_name: "Rianne Isimbi Kabera", email: "rianne.kabera30@ntare-louisenlund.org" },
   { full_name: "Ritha Aimee Himbaza", email: "ritha.himbaza30@ntare-louisenlund.org" },
   { full_name: "Roli Roleck Byishimo", email: "roli.byishimo30@ntare-louisenlund.org" },
   { full_name: "Roni Ngaruye Ndoli", email: "roni.ngaruye30@ntare-louisenlund.org" },
   { full_name: "Ryan Gwiza", email: "ryan.gwiza30@ntare-louisenlund.org" },
   { full_name: "Sacha Olga Keza Habineza", email: "sacha.keza30@ntare-louisenlund.org" },
   { full_name: "Salomon Gikundiro", email: "salomon.gikundiro30@ntare-louisenlund.org" },
   { full_name: "Samson Junior Ndaruhutse", email: "samson.ndaruhutse30@ntare-louisenlund.org" },
   { full_name: "Samuella Ngabo", email: "samuella.ngabo30@ntare-louisenlund.org" },
   { full_name: "Sandra Isaro Mico", email: "sandra.isaro30@ntare-louisenlund.org" },
   { full_name: "Sangwa Derrick Nkusi", email: "sangwa.nkusi30@ntare-louisenlund.org" },
   { full_name: "Shawn Isaac Mfuranzima", email: "shawn.mfuranzima30@ntare-louisenlund.org" },
   { full_name: "Sheja Kelvin Dukuzimana", email: "sheja.dukuzimana30@ntare-louisenlund.org" },
   { full_name: "Shema Licky Muhaye", email: "shema.muhaye30@ntare-louisenlund.org" },
   { full_name: "Sylvie Ineza", email: "sylvie.ineza30@ntare-louisenlund.org" },
   { full_name: "Tekla Isaro Happy", email: "tekla.isaro30@ntare-louisenlund.org" },
   { full_name: "Telissa Ghislaine Micky Sezirahiga Ineza", email: "telissa.sezirahiga30@ntare-louisenlund.org" },
   { full_name: "Tresor Amizero Kagimbura", email: "tresor.amizero30@ntare-louisenlund.org" },
   { full_name: "Tresor Niyogisubizo", email: "tresor.niyogisubizo30@ntare-louisenlund.org" },
   { full_name: "Vaillant Imena Sano", email: "vaillant.imena30@ntare-louisenlund.org" },
   { full_name: "Vanessa Kazubwenge Mahirwe", email: "vanessa.kazubwenge30@ntare-louisenlund.org" },
   { full_name: "Victorien Iradukunda Byishimo", email: "victorien.iradukunda30@ntare-louisenlund.org" },
   { full_name: "Yanis Bucyana", email: "yanis.bucyana30@ntare-louisenlund.org" },
   { full_name: "Yanis Nziza Uramutse", email: "yanis.nziza30@ntare-louisenlund.org" },
   { full_name: "Youri Gatari", email: "youri.gatari30@ntare-louisenlund.org" },
   { full_name: "Yuppie Bruce Havugimana Ntwari", email: "yuppie.havugimana30@ntare-louisenlund.org" },
   // Class 31 students
   { full_name: "Abayo Gatembezi Hermes Aldo", email: "abayo.aldo31@ntare-louisenlund.org" },
   { full_name: "Abe Kamili Pacis", email: "abe.pacis31@ntare-louisenlund.org" },
   { full_name: "Abiela Atete Keza Wafula", email: "abiela.wafula31@ntare-louisenlund.org" },
   { full_name: "Abijuru Gaheta Gabriel", email: "abijuru.gabriel31@ntare-louisenlund.org" },
   { full_name: "Abikunda Isingizwe Christian", email: "abikunda.christian31@ntare-louisenlund.org" },
   { full_name: "Aela Inema Ntagengerwa", email: "aela.ntagengerwa31@ntare-louisenlund.org" },
   { full_name: "Aganze Yannick", email: "aganze.yannick31@ntare-louisenlund.org" },
   { full_name: "Akaliza Rugamba Briana", email: "akaliza.briana31@ntare-louisenlund.org" },
   { full_name: "Albin Gasasira", email: "albin.gasasira31@ntare-louisenlund.org" },
   { full_name: "Anaella Karangwa Mpundu Karangwa", email: "anaella.karangwa31@ntare-louisenlund.org" },
   { full_name: "Arakaza Leo Victor", email: "arakaza.victor31@ntare-louisenlund.org" },
   { full_name: "Ashimwe Keza Gerardine", email: "ashimwe.gerardine31@ntare-louisenlund.org" },
   { full_name: "Asifiwe Briella", email: "asifiwe.briella31@ntare-louisenlund.org" },
   { full_name: "Ayman Issa Nyati", email: "ayman.nyati31@ntare-louisenlund.org" },
   { full_name: "Benihirwe Migisha Gaella", email: "benihirwe.gaella31@ntare-louisenlund.org" },
   { full_name: "Berwa Mukunzi Axel", email: "berwa.axel31@ntare-louisenlund.org" },
   { full_name: "Beza Niella", email: "beza.niella31@ntare-louisenlund.org" },
   { full_name: "Bimenyimana Hirwa Taylor Ineza", email: "bimenyimana.taylor31@ntare-louisenlund.org" },
   { full_name: "Buseyi Gandhi Safari", email: "buseyi.safari31@ntare-louisenlund.org" },
   { full_name: "Byilingiro Renny Ulric", email: "byilingiro.ulric31@ntare-louisenlund.org" },
   { full_name: "Charline Gaju Ngoboka", email: "charline.gaju31@ntare-louisenlund.org" },
   { full_name: "Kwizera Cyubahiro Parfait", email: "cyubahiro.parfait31@ntare-louisenlund.org" },
   { full_name: "Duhirwe Gall Darcy Gavin", email: "duhirwe.gavin31@ntare-louisenlund.org" },
   { full_name: "Farrel Azezue Meryl", email: "farrel.azezue31@ntare-louisenlund.org" },
   { full_name: "Farrell Ingenzi Ezezue", email: "farrell.ezezue31@ntare-louisenlund.org" },
   { full_name: "Gakiza Darcy", email: "gakiza.darcy31@ntare-louisenlund.org" },
   { full_name: "Ganza Uburiza Ivan", email: "ganza.ivan31@ntare-louisenlund.org" },
   { full_name: "Gashumba Uwitonze Happiness", email: "gashumba.happiness31@ntare-louisenlund.org" },
   { full_name: "Georgina Mutavu", email: "georgina.mutavu31@ntare-louisenlund.org" },
   { full_name: "Giramata Caroline Pollet Anna", email: "giramata.anna31@ntare-louisenlund.org" },
   { full_name: "Hindura Irakoze Joshua", email: "hindura.joshua31@ntare-louisenlund.org" },
   { full_name: "Ian Musuhuke", email: "ian.musuhuke31@ntare-louisenlund.org" },
   { full_name: "Ihirwe Bizoza Doreen", email: "ihirwe.doreen31@ntare-louisenlund.org" },
   { full_name: "Ihirwe Kanimba Honnette", email: "ihirwe.honnette31@ntare-louisenlund.org" },
   { full_name: "Ihirwe Nolan", email: "ihirwe.nolan31@ntare-louisenlund.org" },
   { full_name: "Ihirwe Larissa Trinita", email: "ihirwe.trinita31@ntare-louisenlund.org" },
   { full_name: "Ijabo Shami Raphael", email: "ijabo.raphael31@ntare-louisenlund.org" },
   { full_name: "Ikirezi Manzi Kenny", email: "ikirezi.kenny31@ntare-louisenlund.org" },
   { full_name: "Imena Jay Alvin", email: "imena.alvin31@ntare-louisenlund.org" },
   { full_name: "Impano Brave Gloria", email: "impano.gloria31@ntare-louisenlund.org" },
   { full_name: "Inamahoro Murenzi Augure", email: "inamahoro.augure31@ntare-louisenlund.org" },
   { full_name: "Ineza Adelice", email: "ineza.adelice31@ntare-louisenlund.org" },
   { full_name: "Ineza Akaliza Etia", email: "ineza.etia31@ntare-louisenlund.org" },
   { full_name: "Ineza Ingrid", email: "ineza.ingrid31@ntare-louisenlund.org" },
   { full_name: "Ineza Mwizerwa Kaella", email: "ineza.kaella31@ntare-louisenlund.org" },
   { full_name: "Ineza Karekezi Sandra", email: "ineza.sandra31@ntare-louisenlund.org" },
   { full_name: "Iragaba Bryanne", email: "iragaba.bryanne31@ntare-louisenlund.org" },
   { full_name: "Irakoze Uyisabye Ariel", email: "irakoze.ariel31@ntare-louisenlund.org" },
   { full_name: "Irakoze Dieudonne", email: "irakoze.dieudonne31@ntare-louisenlund.org" },
   { full_name: "Irakoze Charly Kenza", email: "irakoze.kenza31@ntare-louisenlund.org" },
   { full_name: "Irakoze Olga", email: "irakoze.olga31@ntare-louisenlund.org" },
   { full_name: "Isaro Simba Darlene", email: "isaro.darlene31@ntare-louisenlund.org" },
   { full_name: "Isaro Luca Praise", email: "isaro.praise31@ntare-louisenlund.org" },
   { full_name: "Ishimwe Benyun", email: "ishimwe.benyun31@ntare-louisenlund.org" },
   { full_name: "Ishimwe Ishema Ishiva", email: "ishimwe.ishiva31@ntare-louisenlund.org" },
   { full_name: "Ishimwe Mugabo Lisa", email: "ishimwe.lisa31@ntare-louisenlund.org" },
   { full_name: "Ishimwe Manene Paulson", email: "ishimwe.paulson31@ntare-louisenlund.org" },
   { full_name: "Iyakaremye Cyomoro Lionel", email: "iyakaremye.lionel31@ntare-louisenlund.org" },
   { full_name: "Izere Christian", email: "izere.christian31@ntare-louisenlund.org" },
   { full_name: "Jabo Murigo Darren", email: "jabo.darren31@ntare-louisenlund.org" },
   { full_name: "Jayden Kalimba Imena", email: "jayden.kalimba31@ntare-louisenlund.org" },
   { full_name: "Joshua Banamwana", email: "joshua.banamwana31@ntare-louisenlund.org" },
   { full_name: "Kabera Honore", email: "kabera.honore31@ntare-louisenlund.org" },
   { full_name: "Kagina Yonathan", email: "kagina.yonathan31@ntare-louisenlund.org" },
   { full_name: "Kamikazi Kyomugisha Kwesiga", email: "kamikazi.kwesiga31@ntare-louisenlund.org" },
   { full_name: "Karangwa Mpundu Anaella Amber", email: "karangwa.amber31@ntare-louisenlund.org" },
   { full_name: "Karema Prince William", email: "karema.william31@ntare-louisenlund.org" },
   { full_name: "Karumyo Muzi Amanda", email: "karumyo.amanda31@ntare-louisenlund.org" },
   { full_name: "Kayitare Du-Perron", email: "kayitare.du-perron31@ntare-louisenlund.org" },
   { full_name: "Kayonga Gabriel Tristan", email: "kayonga.tristan31@ntare-louisenlund.org" },
   { full_name: "Keza Ineza Ilona", email: "keza.ilona31@ntare-louisenlund.org" },
   { full_name: "Kirabo Uwase Desire", email: "kirabo.desire31@ntare-louisenlund.org" },
   { full_name: "Kubwimana Inema Ladouce Nelly", email: "kubwimana.nelly31@ntare-louisenlund.org" },
   { full_name: "Kundwa Migabo Tania", email: "kundwa.tania31@ntare-louisenlund.org" },
   { full_name: "Kwizera Allan", email: "kwizera.allan31@ntare-louisenlund.org" },
   { full_name: "Kwizera Aimé Arsène", email: "kwizera.arsene31@ntare-louisenlund.org" },
   { full_name: "Kwizera Mutemberezi Parfait", email: "kwizera.parfait31@ntare-louisenlund.org" },
   { full_name: "Mahe Owa Ruti Ingenzi Kami", email: "mahe.ruti31@ntare-louisenlund.org" },
   { full_name: "Meira Rebe Rwagasana", email: "meira.rwagasana31@ntare-louisenlund.org" },
   { full_name: "Mico Rurangirwa Clinton", email: "mico.clinton31@ntare-louisenlund.org" },
   { full_name: "Miguel Ntwali Bihira", email: "miguel.bihira31@ntare-louisenlund.org" },
   { full_name: "Misha Katwaza Elora", email: "misha.katwaza31@ntare-louisenlund.org" },
   { full_name: "Mpano Jabo Carmelo", email: "mpano.carmelo31@ntare-louisenlund.org" },
   { full_name: "Mucyo King Pedro", email: "mucyo.pedro31@ntare-louisenlund.org" },
   { full_name: "Mugisha Caleb Gahigana", email: "mugisha.caleb31@ntare-louisenlund.org" },
   { full_name: "Mugisha Abigail Eunice", email: "mugisha.eunice31@ntare-louisenlund.org" },
   { full_name: "Mugisha Louange Chrispin", email: "mugisha.louange31@ntare-louisenlund.org" },
   { full_name: "Munyabuhoro King Ghislain", email: "munyabuhoro.ghislain31@ntare-louisenlund.org" },
   { full_name: "Munyentwari Felicien", email: "munyentwari.felicien31@ntare-louisenlund.org" },
   { full_name: "Mutaganira Manzi Brayan", email: "mutaganira.brayan31@ntare-louisenlund.org" },
   { full_name: "Mutagoma Sugira Precious", email: "mutagoma.precious31@ntare-louisenlund.org" },
   { full_name: "Mutangana Ineza Nailah Blessed", email: "mutangana.blessed31@ntare-louisenlund.org" },
   { full_name: "Namubiru Ronah", email: "namubiru.ronah31@ntare-louisenlund.org" },
   { full_name: "Ndayisenga Shema Davis", email: "ndayisenga.davis31@ntare-louisenlund.org" },
   { full_name: "Ndayishimiye Ineza Gaelle", email: "ndayishimiye.gaelle31@ntare-louisenlund.org" },
   { full_name: "Ngabo Garren", email: "ngabo.garren31@ntare-louisenlund.org" },
   { full_name: "Ngamije Juru Daisy Brionna", email: "ngamije.brionna31@ntare-louisenlund.org" },
   { full_name: "Ngoboka Gaju Charline", email: "ngoboka.charline31@ntare-louisenlund.org" },
   { full_name: "Nise Rise Priya", email: "nise.priya31@ntare-louisenlund.org" },
   { full_name: "Niyonzima Alvin", email: "niyonzima.alvin31@ntare-louisenlund.org" },
   { full_name: "Nkingi Landry Dylan Messi", email: "nkingi.messi31@ntare-louisenlund.org" },
   { full_name: "Nkusi Mutima Lana", email: "nkusi.lana31@ntare-louisenlund.org" },
   { full_name: "Nsengiyumva Joannah Holiness", email: "nsengiyumva.holiness31@ntare-louisenlund.org" },
   { full_name: "Nshuti Munezero Arnaud", email: "nshuti.arnaud31@ntare-louisenlund.org" },
   { full_name: "Oria Murenzi Shami Birkita", email: "oria.shami31@ntare-louisenlund.org" },
   { full_name: "Rutagisha Iradukunda Joshua Eddy", email: "rutagisha.eddy31@ntare-louisenlund.org" },
   { full_name: "Rutayisire Scott keith", email: "rutayisire.scott31@ntare-louisenlund.org" },
   { full_name: "Sheja Vuganeza Horeb", email: "sheja.horeb31@ntare-louisenlund.org" },
   { full_name: "Shema Sebagabo Veran", email: "shema.veran31@ntare-louisenlund.org" },
   { full_name: "Shemeza Utuje Fiona", email: "shemeza.fiona31@ntare-louisenlund.org" },
   { full_name: "Shimwa Mpano Rameaux Brice", email: "shimwa.brice31@ntare-louisenlund.org" },
   { full_name: "Shyaka Pride", email: "shyaka.pride31@ntare-louisenlund.org" },
   { full_name: "Siegrun Frickhinger", email: "siegrun.frickhinger31@ntare-louisenlund.org" },
   { full_name: "Sine Kagenza Muriella", email: "sine.muriella31@ntare-louisenlund.org" },
   { full_name: "Theiss Jabo Akira Ishema", email: "theiss.akira31@ntare-louisenlund.org" },
   { full_name: "Trevor Gisa", email: "trevor.gisa31@ntare-louisenlund.org" },
   { full_name: "Uhirwa Rwigema Faith", email: "uhirwa.faith31@ntare-louisenlund.org" },
   { full_name: "Uwase Nissi", email: "uwase.nissi31@ntare-louisenlund.org" },
   { full_name: "Uwera Lisa Doreen", email: "uwera.doreen31@ntare-louisenlund.org" },
 ];
 
 interface StudentBulkImportProps {
   onComplete: () => void;
 }
 
 const StudentBulkImport = ({ onComplete }: StudentBulkImportProps) => {
   const { toast } = useToast();
   const [isOpen, setIsOpen] = useState(false);
   const [isImporting, setIsImporting] = useState(false);
   const [progress, setProgress] = useState(0);
   const [results, setResults] = useState<ImportResult[]>([]);
   const [showResults, setShowResults] = useState(false);
 
   const handleImport = async () => {
     if (!confirm(`This will attempt to send invite emails to ${STUDENTS_DATA.length} students. Continue?`)) {
       return;
     }
 
     setIsImporting(true);
     setProgress(0);
     setResults([]);
     setShowResults(false);
 
     const importResults: ImportResult[] = [];
     const batchSize = 5; // Process in small batches to avoid rate limiting
 
     for (let i = 0; i < STUDENTS_DATA.length; i += batchSize) {
       const batch = STUDENTS_DATA.slice(i, i + batchSize);
       
       const batchPromises = batch.map(async (student) => {
         try {
           const { data, error } = await supabase.functions.invoke("import-students", {
             body: { 
               email: student.email, 
               full_name: student.full_name 
             },
           });
 
           if (error) {
             return {
               email: student.email,
               status: "error" as const,
               message: error.message || "Failed to create account",
             };
           }
 
           if (data?.exists) {
             return {
               email: student.email,
               status: "exists" as const,
               message: "Account already exists",
             };
           }
 
           return {
             email: student.email,
             status: "success" as const,
             message: "Invite sent successfully",
           };
         } catch (err: any) {
           return {
             email: student.email,
             status: "error" as const,
             message: err.message || "Unknown error",
           };
         }
       });
 
       const batchResults = await Promise.all(batchPromises);
       importResults.push(...batchResults);
       
       setProgress(Math.round((importResults.length / STUDENTS_DATA.length) * 100));
       
       // Small delay between batches to avoid rate limiting
       if (i + batchSize < STUDENTS_DATA.length) {
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
         <Button>
           <Upload className="h-4 w-4 mr-2" />
           Import Students
         </Button>
       </DialogTrigger>
       <DialogContent className="max-w-2xl">
         <DialogHeader>
           <DialogTitle>Bulk Import Students</DialogTitle>
           <DialogDescription>
             Import {STUDENTS_DATA.length} students from the uploaded member list. 
             Each student will receive an email invitation to set their password.
           </DialogDescription>
         </DialogHeader>
 
         {!showResults ? (
           <div className="py-4">
             {isImporting ? (
               <div className="space-y-4">
                 <div className="flex items-center gap-2">
                   <Loader2 className="h-4 w-4 animate-spin" />
                   <span>Importing students... {progress}%</span>
                 </div>
                 <Progress value={progress} />
               </div>
             ) : (
               <div className="space-y-4">
                 <div className="bg-muted/50 rounded-lg p-4">
                   <h4 className="font-medium mb-2">Preview</h4>
                   <p className="text-sm text-muted-foreground mb-3">
                     First 5 students to be imported:
                   </p>
                   <div className="space-y-2">
                     {STUDENTS_DATA.slice(0, 5).map((student, idx) => (
                       <div key={idx} className="text-sm flex justify-between">
                         <span>{student.full_name}</span>
                         <span className="text-muted-foreground">{student.email}</span>
                       </div>
                     ))}
                     <div className="text-sm text-muted-foreground pt-2">
                       ... and {STUDENTS_DATA.length - 5} more
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
 
 export default StudentBulkImport;