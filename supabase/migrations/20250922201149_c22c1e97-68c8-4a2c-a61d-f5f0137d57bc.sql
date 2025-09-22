-- Create an enum for user roles
CREATE TYPE public.app_role AS ENUM ('user', 'cafeteria_admin', 'system_admin');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = user_uuid ORDER BY 
    CASE role 
      WHEN 'system_admin' THEN 1
      WHEN 'cafeteria_admin' THEN 2
      WHEN 'user' THEN 3
    END
  LIMIT 1;
$$;

-- Function to check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(user_uuid UUID, check_role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = check_role
  );
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'system_admin'));

CREATE POLICY "System admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'system_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default user role for existing users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles);

-- Update menu_items policies for cafeteria admins
DROP POLICY IF EXISTS "Anyone can view available menu items" ON public.menu_items;

CREATE POLICY "Anyone can view available menu items"
ON public.menu_items
FOR SELECT
USING (is_available = true);

CREATE POLICY "Cafeteria admins can manage menu items"
ON public.menu_items
FOR ALL
USING (public.has_role(auth.uid(), 'cafeteria_admin') OR public.has_role(auth.uid(), 'system_admin'));