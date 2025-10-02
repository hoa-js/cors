## @hoajs/cors

CORS middleware for Hoa.

## Installation

```bash
$ npm i @hoajs/cors --save
```

## Quick Start

```js
import { Hoa } from 'hoa'
import { cors } from '@hoajs/cors'

const app = new Hoa()
app.use(cors())

app.use(async (ctx) => {
  ctx.res.body = 'Hello, Hoa!'
})

export default app
```

## Documentation

The documentation is available on [hoa-js.com](https://hoa-js.com/middleware/cors.html)

## Test (100% coverage)

```sh
$ npm test
```

## License

MIT
