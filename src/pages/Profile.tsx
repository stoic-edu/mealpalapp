import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { User, Settings } from 'lucide-react';

interface Profile {
  id: string;
  display_name: string;
  dietary_preferences: string[];
}

const DIETARY_OPTIONS = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'low-carb',
  'keto',
  'halal',
  'kosher',
  'organic'
];

const Profile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || '');
        setDietaryPreferences(data.dietary_preferences || []);
      } else {
        // Create profile if it doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: user!.id,
            display_name: user!.user_metadata?.display_name || '',
            dietary_preferences: []
          })
          .select()
          .single();

        if (createError) throw createError;
        
        setProfile(newProfile);
        setDisplayName(newProfile.display_name || '');
        setDietaryPreferences(newProfile.dietary_preferences || []);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to fetch profile data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          dietary_preferences: dietaryPreferences
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: "Profile updated!",
        description: "Your profile has been saved successfully"
      });

      // Update local state
      setProfile({
        ...profile,
        display_name: displayName,
        dietary_preferences: dietaryPreferences
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleDietaryPreference = (preference: string) => {
    setDietaryPreferences(prev => 
      prev.includes(preference)
        ? prev.filter(p => p !== preference)
        : [...prev, preference]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Account Information</span>
          </CardTitle>
          <CardDescription>Your basic account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Email</Label>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Account Created</Label>
              <p className="text-sm text-muted-foreground">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Profile Settings</span>
          </CardTitle>
          <CardDescription>Customize your MealPal experience</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Enter your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              <Label>Dietary Preferences</Label>
              <p className="text-sm text-muted-foreground">
                Select your dietary preferences to get better meal recommendations
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {DIETARY_OPTIONS.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={option}
                      checked={dietaryPreferences.includes(option)}
                      onCheckedChange={() => toggleDietaryPreference(option)}
                    />
                    <Label 
                      htmlFor={option} 
                      className="text-sm font-normal capitalize cursor-pointer"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
              
              {dietaryPreferences.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-sm font-medium">Selected:</span>
                  {dietaryPreferences.map((pref) => (
                    <Badge key={pref} variant="secondary" className="capitalize">
                      {pref}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;