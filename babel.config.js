module.exports = {
    presets: [
        require('@babel/preset-env')
    ],
    plugins: [
        require('@babel/plugin-proposal-function-bind'),
        require('@babel/plugin-proposal-unicode-property-regex')
    ]
};