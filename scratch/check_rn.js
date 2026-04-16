const rn = require('react-native');
console.log('TouchableOpacity exists:', !!rn.TouchableOpacity);
console.log('Available keys:', Object.keys(rn).filter(k => k.includes('Touchable')));
