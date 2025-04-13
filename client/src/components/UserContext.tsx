import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserProfile } from '@/types';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { getDeviceId } from '@/lib/deviceId';

interface UserContextType {
  user: User | null;
  loading: boolean;
  hasSurveyCompleted: boolean;
  setHasSurveyCompleted: (value: boolean) => void;
  updateUserProfile: (profile: UserProfile) => Promise<void>;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  hasSurveyCompleted: false,
  setHasSurveyCompleted: () => {},
  updateUserProfile: async () => {},
  isAuthenticated: false,
  logout: async () => {},
});

export const useUser = () => useContext(UserContext);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider = ({ children }: UserProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSurveyCompleted, setHasSurveyCompleted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const deviceId = getDeviceId();
        const response = await fetch('/api/user/profile', {
          credentials: 'include',
          headers: {
            'X-Device-ID': deviceId
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setHasSurveyCompleted(userData.hasSurveyCompleted);
        } else {
          // Create a demo user with device ID
          const demoUser: User = {
            id: 0,
            username: 'device_' + deviceId.substring(0, 8),
            hasSurveyCompleted: false,
            userProfile: undefined,
            deviceId: deviceId
          };
          setUser(demoUser);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // Create a demo user with device ID if error
        const deviceId = getDeviceId();
        const demoUser: User = {
          id: 0,
          username: 'device_' + deviceId.substring(0, 8),
          hasSurveyCompleted: false,
          userProfile: undefined,
          deviceId: deviceId
        };
        setUser(demoUser);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const updateUserProfile = async (profile: UserProfile) => {
    try {
      const deviceId = getDeviceId();
      const response = await apiRequest(
        'POST', 
        '/api/user/profile', 
        { ...profile, deviceId },
        {
          headers: {
            'X-Device-ID': deviceId
          }
        }
      );
      
      if (response.ok) {
        const updatedUser = await response.json();
        setUser((prevUser: User | null) => prevUser ? { ...prevUser, userProfile: updatedUser.userProfile } : null);
        toast({
          title: 'Profile Updated',
          description: 'Your profile has been successfully updated.',
        });
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update your profile. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const logout = async () => {
    try {
      const deviceId = getDeviceId();
      await apiRequest(
        'POST', 
        '/api/auth/logout', 
        { deviceId }, 
        {
          headers: {
            'X-Device-ID': deviceId
          }
        }
      );
      setUser(null);
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
      });
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        hasSurveyCompleted,
        setHasSurveyCompleted,
        updateUserProfile,
        isAuthenticated: !!user && user.id !== 0,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
