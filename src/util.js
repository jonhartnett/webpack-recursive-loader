export function* map(func){
    let i = 0;
    for(let value of this)
        yield this::func(value, i++);
}

export function* filter(func){
    let i = 0;
    for(let value of this){
        if(this::func(value, i++))
            yield value;
    }
}

export function* keys(){
    for(let key in this){
        if(Object.hasOwnProperty.call(this, key))
            yield key;
    }
}

export function* entries(){
    for(let key of this::keys())
        yield [key, this[key]];
}

export function join(sep=''){
    let str = '';
    let i = 0;
    for(let value of this){
        if(i++ > 0)
            str += sep;
        str += value;
    }
    return str;
}

export function toQueryString(options){
    return options::entries()
        ::map(([key, value]) => {
            const encode = encodeURIComponent;
            if(typeof value === 'string'){
                return `${encode(key)}=${encode(value)}`;
            }else if(typeof value === 'boolean'){
                if(value)
                    return encode(key);
                else
                    return null;
            }else if(value == null){
                return null;
            }else{
                throw new Error(`Unsupported query string value: ${value}`);
            }
        })
        ::filter(Boolean)
        ::join('&');
}

export function fromQueryString(str){
    const decode = decodeURIComponent;
    let options = Object.create(null);
    for(let part of str.split('&')){
        let [key, value] = part.split('=');
        key = decode(key);
        value = (value == null) ? true : decode(value);
        options[key] = value;
    }
    return options;
}

export function cacheDecorator(keyFunc, cacheKey=Symbol('cache')){
    return function(func){
        let wrapper = function(){
            let cache = this[cacheKey];
            if(cache == null)
                cache = this[cacheKey] = new Map();
            let key = this::keyFunc(...arguments);
            if(cache.has(key))
                return cache.get(key);
            let value = this::func(...arguments);
            cache.set(key, value);
            return value;
        };
        //copy name, length, etc.
        Object.defineProperties(wrapper, Object.getOwnPropertyDescriptors(func));
        return wrapper;
    };
}
