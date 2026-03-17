-- Assign teacher role to all NLS teaching staff by email.
-- Run this once in the Supabase SQL Editor.
-- Safe to re-run: ON CONFLICT DO UPDATE is idempotent.

WITH teacher_emails(email) AS (
  VALUES
    ('alina.herzog@ntare-louisenlund.org'),
    ('alphonse.maniraguha@ntare-louisenlund.org'),
    ('bhatia.sakshi@ntare-louisenlund.org'),
    ('caleb.asiso@ntare-louisenlund.org'),
    ('christoph.frickhinger@ntare-louisenlund.org'),
    ('david.nishimwe@ntare-louisenlund.org'),
    ('david.niyitegeka@ntare-louisenlund.org'),
    ('davis.omondi@ntare-louisenlund.org'),
    ('edagbo.blessing@ntare-louisenlund.org'),
    ('francine.mukankusi@ntare-louisenlund.org'),
    ('gloria.mutoni@ntare-louisenlund.org'),
    ('irene.gashagaza@ntare-louisenlund.org'),
    ('jean.mbarushimana@ntare-louisenlund.org'),
    ('jean.murenzi@ntare-louisenlund.org'),
    ('jean.nyabyenda@ntare-louisenlund.org'),
    ('kathleen.challenor@ntare-louisenlund.org'),
    ('kennedy.koja@ntare-louisenlund.org'),
    ('linnet.chebet@ntare-louisenlund.org'),
    ('lisa.rucyaha@ntare-louisenlund.org'),
    ('mauritz.viljoen@ntare-louisenlund.org'),
    ('mildred.nabunje@ntare-louisenlund.org'),
    ('patrick.muhire@ntare-louisenlund.org'),
    ('pierre.niyibigira@ntare-louisenlund.org'),
    ('piotr-tomaszczuk@ntare-louisenlund.org'),
    ('pontien.ntirenganya@ntare-louisenlund.org'),
    ('praveen.rana@ntare-louisenlund.org'),
    ('robert.tugume@ntare-louisenlund.org'),
    ('scovia.kabanyana@ntare-louisenlund.org'),
    ('sebastian.wagner@ntare-louisenlund.org'),
    ('solange.uwiduhaye@ntare-louisenlund.org'),
    ('stacy.hill@ntare-louisenlund.org'),
    ('welford.mclellan@ntare-louisenlund.org')
),
matched AS (
  SELECT au.id AS user_id
  FROM auth.users au
  INNER JOIN teacher_emails te ON lower(au.email) = lower(te.email)
)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'teacher' FROM matched
ON CONFLICT (user_id) DO UPDATE SET role = 'teacher';

-- Show how many were matched and updated
SELECT count(*) AS teachers_assigned
FROM public.user_roles ur
INNER JOIN auth.users au ON au.id = ur.user_id
INNER JOIN teacher_emails te ON lower(au.email) = lower(te.email)
WHERE ur.role = 'teacher';
