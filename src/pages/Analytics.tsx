import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays } from 'date-fns';

interface Transaction {
  id: string;
  amount: number;
  transaction_date: string;
  menu_items: {
    name: string;
    category: string;
  };
}

interface DailySpending {
  date: string;
  amount: number;
}

interface CategorySpending {
  category: string;
  amount: number;
  count: number;
}

const Analytics = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dailySpending, setDailySpending] = useState<DailySpending[]>([]);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
    }
  }, [user]);

  const fetchAnalyticsData = async () => {
    try {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      // Fetch transactions with menu item details
      const { data: transactionData, error } = await supabase
        .from('transactions')
        .select(`
          id,
          amount,
          transaction_date,
          menu_items (
            name,
            category
          )
        `)
        .eq('user_id', user!.id)
        .gte('transaction_date', thirtyDaysAgo)
        .order('transaction_date', { ascending: true });

      if (error) throw error;

      const transactions = transactionData || [];
      setTransactions(transactions);

      // Calculate total spending
      const total = transactions.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
      setTotalSpent(total);

      // Process daily spending
      const dailyData = processDailySpending(transactions);
      setDailySpending(dailyData);

      // Process category spending
      const categoryData = processCategorySpending(transactions);
      setCategorySpending(categoryData);

    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const processDailySpending = (transactions: Transaction[]): DailySpending[] => {
    const dailyMap = new Map<string, number>();
    
    // Initialize with last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      dailyMap.set(date, 0);
    }

    // Add transaction amounts
    transactions.forEach(t => {
      const date = t.transaction_date.split('T')[0];
      if (dailyMap.has(date)) {
        dailyMap.set(date, dailyMap.get(date)! + parseFloat(t.amount.toString()));
      }
    });

    return Array.from(dailyMap.entries()).map(([date, amount]) => ({
      date: format(new Date(date), 'MMM dd'),
      amount: Number(amount.toFixed(2))
    }));
  };

  const processCategorySpending = (transactions: Transaction[]): CategorySpending[] => {
    const categoryMap = new Map<string, { amount: number; count: number }>();

    transactions.forEach(t => {
      const category = t.menu_items?.category || 'Unknown';
      const current = categoryMap.get(category) || { amount: 0, count: 0 };
      categoryMap.set(category, {
        amount: current.amount + parseFloat(t.amount.toString()),
        count: current.count + 1
      });
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      amount: Number(data.amount.toFixed(2)),
      count: data.count
    })).sort((a, b) => b.amount - a.amount);
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Spending Analytics</h1>
        <p className="text-muted-foreground">Insights into your meal spending patterns</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average per Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${transactions.length > 0 ? (totalSpent / transactions.length).toFixed(2) : '0.00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalSpent / 30).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Spending Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Spending (Last 7 Days)</CardTitle>
            <CardDescription>Your spending pattern over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailySpending}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [`$${value}`, 'Amount']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Spending Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>Breakdown of spending by food category</CardDescription>
          </CardHeader>
          <CardContent>
            {categorySpending.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categorySpending}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                    label={({ category, amount }) => `${category}: $${amount}`}
                  >
                    {categorySpending.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Details */}
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
          <CardDescription>Detailed spending by food category</CardDescription>
        </CardHeader>
        <CardContent>
          {categorySpending.length > 0 ? (
            <div className="space-y-3">
              {categorySpending.map((category, index) => (
                <div key={category.category} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div>
                      <p className="font-medium">{category.category}</p>
                      <p className="text-sm text-muted-foreground">
                        {category.count} transaction{category.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${category.amount.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      ${(category.amount / category.count).toFixed(2)} avg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No spending data available. Start purchasing meals to see analytics!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;