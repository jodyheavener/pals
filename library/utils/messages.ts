// I can't get Serverless to bundle the locale files,
// so for now we do it all inline.

const locales: { [key: string]: any } = {
  en: {
    languages: {
      en: 'English',
      fr: 'French',
    },
    welcome: "Welcome to Pals! Let's connect you with someone.",
    whatsYourName: [
      "So, what's your first name?",
      'What would you like to be called?',
      'Who are you?',
    ],
    seenByYourPal: [
      'Your Pal will see this.',
      'This will be what your Pal sees.',
    ],
    cantHelpYou: "Sorry, we can't connect you right now.",
    ready: "Hey, %{name}! You're all set.",
    unpairedCommands:
      "Here's what you can do:\rPAIR - find a Pal\rLEAVE - delete your account",
    pairedCommands:
      "Here's what you can do:\rBYE - leave your Pal forever\rEXIT - return to Pal",
    connecting:
      "We're connecting you to a new Pal. This could take some time depending on how many people are available.",
    connected:
      "You are now paired with %{name}! Messages you send will go directly to them. Text '> MENU' to activate the menu.",
    menuOpen:
      "Menu active. You'll still receive messages from your Pal, but your messages will not be sent to them for now.",
    disconnected: "You've been disconnected from your Pal.",
    deleteConfirmation:
      'Are you sure you want to delete your Pals account? Respond with YES to confirm.',
    accountDeleted: 'Your account has been deleted! Text us any time.',
    deleteCancelled: 'Account not deleted.',
    stillPairing:
      "Hang tight, we're still looking for a Pal to connect you with.",
    partnerEndedChat: 'Your Pal %{name} ended the chat.',
    youEndedChat: 'The chat has ended.',
  },
};

// const locales: { [key: string]: any } = {
//   en: require('../../../locales/en.json'),
//   fr: require('../../../locales/fr.json'),
// };

export function getMessage(
  code: string,
  key: string,
  replacements?: { [key: string]: any }
) {
  function performReplacements(string: string) {
    if (
      string !== null &&
      replacements != null &&
      typeof replacements === 'object'
    ) {
      var _matchesForRegex = string.match(/%{[a-zA-Z]+[a-zA-Z0-9_]*}/g);
      if (null !== _matchesForRegex) {
        for (var _m in _matchesForRegex) {
          var _theMatch = _matchesForRegex[_m];
          if (_theMatch.replace('%{', '').replace('}', '') in replacements) {
            string = string.replace(
              _theMatch,
              replacements[_theMatch.replace('%{', '').replace('}', '')]
            );
          }
        }
      }
    }

    return string;
  }

  let messages = locales[code][key];

  if (typeof messages === 'string') {
    messages = [messages];
  }

  const selectedMessage = messages[Math.floor(Math.random() * messages.length)];
  return performReplacements(selectedMessage);
}
