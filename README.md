# openwebrxplus-superpower
POC of Superpower plugin for OpenWebRX+

## Functionality
- Increased zoom levels count
- Increased waterfall refresh rate 
- Enlargement of waterfall display area
- Ability to set any frequency
- Ability to change the gain level / switch between auto/manual
- Last profile memory (experimental)

## Installation
1) Create an SDR device profile whose name starts with 'unlocked' (case-insensitive)
2) Go to Settings > General Settings and put compiled JavaScript code inside Receiver information > Photo description
   Make sure to put plugin code inside <script>...</script> tags.
3) Individual options can be configured by modifying boolean variables in the superpower_settings module/structure.
4) Plugin functionality is available after logging in as an administrator and selecting the newly created profile.

## Support
You use this plugin at your own risk. There is no guarantee.