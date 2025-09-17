-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  dietary_preferences TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create budgets table for user budget settings
CREATE TABLE public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_type TEXT NOT NULL CHECK (budget_type IN ('daily', 'weekly')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create menu_items table for cafeteria menu
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(8,2) NOT NULL CHECK (price > 0),
  category TEXT NOT NULL,
  dietary_tags TEXT[],
  available_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table for user purchases
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id),
  amount DECIMAL(8,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meal_recommendations table for daily suggestions
CREATE TABLE public.meal_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommended_date DATE NOT NULL DEFAULT CURRENT_DATE,
  menu_item_ids UUID[],
  total_estimated_cost DECIMAL(8,2),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, recommended_date)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_recommendations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for budgets
CREATE POLICY "Users can view their own budgets" ON public.budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own budgets" ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own budgets" ON public.budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own budgets" ON public.budgets FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for menu_items (public read access)
CREATE POLICY "Anyone can view available menu items" ON public.menu_items FOR SELECT USING (is_available = true);

-- Create RLS policies for transactions
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for meal_recommendations
CREATE POLICY "Users can view their own recommendations" ON public.meal_recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own recommendations" ON public.meal_recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recommendations" ON public.meal_recommendations FOR UPDATE USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert sample menu items
INSERT INTO public.menu_items (name, description, price, category, dietary_tags) VALUES
('Grilled Chicken Sandwich', 'Juicy grilled chicken breast with lettuce and tomato', 8.99, 'Main Course', ARRAY['protein', 'gluten']),
('Caesar Salad', 'Fresh romaine lettuce with parmesan cheese and croutons', 6.50, 'Salad', ARRAY['vegetarian']),
('Vegetable Stir Fry', 'Mixed vegetables with rice', 7.25, 'Main Course', ARRAY['vegetarian', 'vegan']),
('Beef Burger', 'Classic beef burger with fries', 9.99, 'Main Course', ARRAY['protein', 'gluten']),
('Fruit Smoothie', 'Mixed berry smoothie', 4.50, 'Beverage', ARRAY['vegan', 'healthy']),
('Pizza Slice', 'Cheese pizza slice', 3.99, 'Main Course', ARRAY['vegetarian', 'gluten']),
('Soup of the Day', 'Daily special soup with bread', 5.50, 'Soup', ARRAY['vegetarian']);