import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { ShoppingCart, Lightbulb } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  dietary_tags: string[];
}

interface Recommendation {
  id: string;
  menu_item_ids: string[];
  total_estimated_cost: number;
  reason: string;
}

const Menu = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchMenuData();
  }, [user]);

  const fetchMenuData = async () => {
    try {
      // Fetch menu items
      const { data: items, error: menuError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_available', true)
        .eq('available_date', new Date().toISOString().split('T')[0]);

      if (menuError) throw menuError;
      setMenuItems(items || []);

      // Fetch today's recommendation
      if (user) {
        const { data: rec, error: recError } = await supabase
          .from('meal_recommendations')
          .select('*')
          .eq('user_id', user.id)
          .eq('recommended_date', new Date().toISOString().split('T')[0])
          .maybeSingle();

        if (recError && recError.code !== 'PGRST116') throw recError;
        setRecommendation(rec);

        // Generate recommendation if none exists
        if (!rec && items?.length) {
          generateRecommendation(items);
        }
      }
    } catch (error) {
      console.error('Error fetching menu data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch menu data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendation = async (items: MenuItem[]) => {
    try {
      // Get user's active budget
      const { data: budget } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!budget) return;

      // Simple recommendation logic: find items within budget
      const dailyBudget = budget.budget_type === 'daily' ? budget.amount : budget.amount / 7;
      const affordable = items.filter(item => item.price <= dailyBudget);
      
      if (affordable.length === 0) return;

      // Recommend items that fit within budget
      const recommended = affordable.slice(0, 3);
      const totalCost = recommended.reduce((sum, item) => sum + item.price, 0);

      const { error } = await supabase
        .from('meal_recommendations')
        .insert({
          user_id: user!.id,
          recommended_date: new Date().toISOString().split('T')[0],
          menu_item_ids: recommended.map(item => item.id),
          total_estimated_cost: totalCost,
          reason: `Based on your ${budget.budget_type} budget of $${budget.amount}`
        });

      if (!error) {
        setRecommendation({
          id: 'temp',
          menu_item_ids: recommended.map(item => item.id),
          total_estimated_cost: totalCost,
          reason: `Based on your ${budget.budget_type} budget of $${budget.amount}`
        });
      }
    } catch (error) {
      console.error('Error generating recommendation:', error);
    }
  };

  const handlePurchase = async (item: MenuItem) => {
    if (!user) return;
    
    setPurchaseLoading(item.id);
    
    try {
      const { error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          menu_item_id: item.id,
          amount: item.price,
          quantity: 1
        });

      if (error) throw error;

      toast({
        title: "Purchase recorded!",
        description: `${item.name} - $${item.price.toFixed(2)}`
      });
    } catch (error) {
      console.error('Error recording purchase:', error);
      toast({
        title: "Error",
        description: "Failed to record purchase",
        variant: "destructive"
      });
    } finally {
      setPurchaseLoading(null);
    }
  };

  const getRecommendedItems = () => {
    if (!recommendation) return [];
    return menuItems.filter(item => recommendation.menu_item_ids.includes(item.id));
  };

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Today's Menu</h1>
        <p className="text-muted-foreground">Fresh meals available now</p>
      </div>

      {recommendation && getRecommendedItems().length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              <span>Today's Recommendations</span>
            </CardTitle>
            <CardDescription>{recommendation.reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {getRecommendedItems().map((item) => (
                <Card key={item.id} className="border-primary/30">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                        <CardDescription className="text-sm">{item.description}</CardDescription>
                      </div>
                      <Badge variant="secondary">{formatPrice(item.price)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {item.dietary_tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      onClick={() => handlePurchase(item)}
                      disabled={purchaseLoading === item.id}
                      className="w-full"
                      size="sm"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {purchaseLoading === item.id ? 'Recording...' : 'Purchase'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Badge variant="outline" className="text-lg px-3 py-1">
                Total: {formatPrice(recommendation.total_estimated_cost)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {menuItems.map((item) => (
          <Card key={item.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
                <Badge variant="secondary">{formatPrice(item.price)}</Badge>
              </div>
              <Badge variant="outline" className="w-fit">
                {item.category}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {item.dietary_tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Button
                onClick={() => handlePurchase(item)}
                disabled={purchaseLoading === item.id}
                className="w-full"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {purchaseLoading === item.id ? 'Recording...' : 'Purchase'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {menuItems.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No menu items available today.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Menu;