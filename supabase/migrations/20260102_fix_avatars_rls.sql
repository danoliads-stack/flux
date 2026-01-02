-- 1. Profiles Table Updates
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Operadores Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.operadores;
CREATE POLICY "Enable read access for all users"
ON public.operadores FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Enable all access for admins and supervisors" ON public.operadores;
CREATE POLICY "Enable all access for admins and supervisors"
ON public.operadores FOR ALL
TO authenticated
USING (true);

-- 3. Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN');

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN');

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN');

-- 4. Storage Policies (Bucket: avatars)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
