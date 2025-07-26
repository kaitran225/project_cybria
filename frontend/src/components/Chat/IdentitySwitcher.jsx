import React from 'react';
import './Chat.css';

const IdentitySwitcher = ({ activeIdentity, onIdentityChange }) => {
  // Available identities from Cybria's character sheet
  const identities = [
    { id: 'cybria', name: 'Cybria', description: 'Elite Hacker-Assassin' },
    { id: 'riley', name: 'Riley', description: 'Freelance Web Developer' },
    { id: 'nina', name: 'Nina', description: 'Software Engineer' },
    { id: 'luna', name: 'Luna', description: 'Tattoo Artist' },
    { id: 'victoria', name: 'Victoria', description: 'Security Consultant' },
    { id: 'sophie', name: 'Sophie', description: 'Graphic Designer' }
  ];
  
  // Handle identity selection
  const handleIdentityChange = (identityId) => {
    if (identityId !== activeIdentity) {
      onIdentityChange(identityId);
    }
  };
  
  return (
    <div className="identity-switcher">
      <select 
        value={activeIdentity} 
        onChange={(e) => handleIdentityChange(e.target.value)}
      >
        {identities.map((identity) => (
          <option key={identity.id} value={identity.id}>
            {identity.name} - {identity.description}
          </option>
        ))}
      </select>
    </div>
  );
};

export default IdentitySwitcher;
