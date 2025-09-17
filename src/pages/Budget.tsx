import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface Budget {
  id: string;
  budget_type: 'daily' | 'weekly';
  amount: number;
  is_active: boolean;
}

interface SpendingSummary {
  today: number;
  thisWeek: number;
  dailyAverage: number;
}

const Budget = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spending, setSpending] = useState<SpendingSummary>({ today: 0, thisWeek: 0, dailyAverage: 0 });
  const [newBudgetAmount, setNewBudgetAmount] = useState('');
  const [newBudgetType, setNewBudgetType] = useState<'daily' | 'weekly'>('daily');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchBudgetData();
    }
  }, [user]);

  const fetchBudgetData = async () => {
    try {
      // Fetch budgets
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (budgetError) throw budgetError;
      setBudgets((budgetData as Budget[]) || []);

      // Fetch spending data
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('amount, transaction_date')
        .eq('user_id', user!.id)
        .gte('transaction_date', weekAgo);

      if (transError) throw transError;

      // Calculate spending
      const todaySpending = transactions
        ?.filter(t => t.transaction_date.startsWith(today))
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;

      const weekSpending = transactions
        ?.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;

      const dailyAverage = weekSpending / 7;

      setSpending({
        today: todaySpending,
        thisWeek: weekSpending,
        dailyAverage
      });
    } catch (error) {
      console.error('Error fetching budget data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch budget data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudgetAmount || !user) return;

    setSaving(true);
    try {
      // Deactivate existing budgets of the same type
      await supabase
        .from('budgets')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('budget_type', newBudgetType);

      // Create new budget
      const { error } = await supabase
        .from('budgets')
        .insert({
          user_id: user.id,
          budget_type: newBudgetType,
          amount: parseFloat(newBudgetAmount),
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Budget created!",
        description: `${newBudgetType} budget of $${newBudgetAmount} set successfully`
      });

      setNewBudgetAmount('');
      fetchBudgetData();
    } catch (error) {
      console.error('Error creating budget:', error);
      toast({
        title: "Error",
        description: "Failed to create budget",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleBudgetStatus = async (budgetId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('budgets')
        .update({ is_active: !currentStatus })
        .eq('id', budgetId);

      if (error) throw error;

      toast({
        title: "Budget updated",
        description: `Budget ${!currentStatus ? 'activated' : 'deactivated'}`
      });

      fetchBudgetData();
    } catch (error) {
      console.error('Error updating budget:', error);
      toast({
        title: "Error",
        description: "Failed to update budget",
        variant: "destructive"
      });
    }
  };

  const getActiveBudget = () => budgets.find(b => b.is_active);

  const getBudgetProgress = () => {
    const activeBudget = getActiveBudget();
    if (!activeBudget) return { progress: 0, isOverBudget: false, dailyLimit: 0 };

    const dailyLimit = activeBudget.budget_type === 'daily' 
      ? activeBudget.amount 
      : activeBudget.amount / 7;

    const progress = (spending.today / dailyLimit) * 100;
    const isOverBudget = spending.today > dailyLimit;

    return { progress: Math.min(progress, 100), isOverBudget, dailyLimit };
  };

  const { progress, isOverBudget, dailyLimit } = getBudgetProgress();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading budget data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Budget Management</h1>
        <p className="text-muted-foreground">Track and manage your meal spending</p>
      </div>

      {/* Budget Alert */}
      {isOverBudget && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Budget Alert!</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              You've exceeded your daily budget of ${dailyLimit.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Spending Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Spending</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${spending.today.toFixed(2)}</div>
            {dailyLimit > 0 && (
              <div className="mt-2">
                <Progress 
                  value={progress} 
                  className={`h-2 ${isOverBudget ? 'bg-destructive/20' : ''}`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ${dailyLimit.toFixed(2)} daily limit
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${spending.thisWeek.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${spending.dailyAverage.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Create New Budget */}
      <Card>
        <CardHeader>
          <CardTitle>Set New Budget</CardTitle>
          <CardDescription>Create a daily or weekly spending limit</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateBudget} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="50.00"
                  value={newBudgetAmount}
                  onChange={(e) => setNewBudgetAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Budget Type</Label>
                <Select value={newBudgetType} onValueChange={(value: 'daily' | 'weekly') => setNewBudgetType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Budget'
            }</Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Budgets */}
      <Card>
        <CardHeader>
          <CardTitle>Your Budgets</CardTitle>
          <CardDescription>Manage your existing budgets</CardDescription>
        </CardHeader>
        <CardContent>
          {budgets.length > 0 ? (
            <div className="space-y-3">
              {budgets.map((budget) => (
                <div
                  key={budget.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div>
                      <p className="font-medium">
                        ${budget.amount.toFixed(2)} / {budget.budget_type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {budget.budget_type === 'weekly' 
                          ? `~$${(budget.amount / 7).toFixed(2)} per day`
                          : 'Daily budget'
                        }
                      </p>
                    </div>
                    <Badge variant={budget.is_active ? 'default' : 'secondary'}>
                      {budget.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleBudgetStatus(budget.id, budget.is_active)}
                  >
                    {budget.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No budgets created yet. Create your first budget above.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Budget;
