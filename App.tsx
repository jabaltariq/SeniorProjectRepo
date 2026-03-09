import React from 'react';
import { useAuthViewModel } from './viewModels/useAuthViewModel';
import { useLoginFormViewModel, useSignUpFormViewModel } from './viewModels/useAuthFormsViewModel';
import { useDashboardViewModel } from './viewModels/useDashboardViewModel';
import { LoginView } from './views/LoginView';
import { SignUpView } from './views/SignUpView';
import { DashboardView } from './views/DashboardView';

/**
 * App - MVVM Root
 * Binds ViewModels to Views. No business logic here.
 */
const App: React.FC = () => {
  const auth = useAuthViewModel();
  const loginForm = useLoginFormViewModel(auth.onLoginSuccess);
  const signUpForm = useSignUpFormViewModel(auth.onSignUpSuccess);
  const dashboard = useDashboardViewModel(auth);

  if (auth.authView === 'login') {
    return (
      <LoginView
        onSwitchToSignUp={auth.showSignUp}
        onSubmit={loginForm.submit}
        error={loginForm.error}
        loading={loginForm.loading}
      />
    );
  }

  if (auth.authView === 'signup') {
    return (
      <SignUpView
        onSwitchToLogin={auth.showLogin}
        onSubmit={signUpForm.submit}
        error={signUpForm.error}
        loading={signUpForm.loading}
      />
    );
  }

  return (
    <DashboardView
      balance={dashboard.betting.balance}
      activeBets={dashboard.betting.activeBets}
      betSelection={dashboard.betting.betSelection}
      dailyBonusAvailable={dashboard.betting.dailyBonusAvailable}
      bonusMessage={dashboard.betting.bonusMessage}
      view={dashboard.view}
      userInitials={dashboard.auth.userInitials}
      userEmail={dashboard.auth.userEmail ?? ''}
      sportFilter={dashboard.markets.sportFilter}
      leagueFilter={dashboard.markets.leagueFilter}
      searchQuery={dashboard.markets.searchQuery}
      sportTabs={dashboard.markets.sportTabs}
      availableLeagues={dashboard.markets.availableLeagues}
      markets={dashboard.markets.markets}
      loading={dashboard.markets.loading}
      error={dashboard.markets.error}
      leaderboardEntries={dashboard.leaderboardEntries}
      friends={dashboard.friends}
      activity={dashboard.activity}
      onPlaceBet={dashboard.betting.handlePlaceBet}
      onClearBet={dashboard.betting.clearBetSelection}
      onSelectBet={dashboard.betting.selectBet}
      onDailyBonus={dashboard.betting.handleDailyBonus}
      onLogout={dashboard.auth.logout}
      onSetView={dashboard.setView}
      onSportFilter={dashboard.markets.handleSportFilter}
      onLeagueFilter={dashboard.markets.setLeagueFilter}
      onSearchChange={dashboard.markets.setSearchQuery}
      onRetryMarkets={dashboard.markets.loadMarkets}
      onChallenge={dashboard.handleChallenge}
    />
  );
};

export default App;
