# pgzx

_[google/zx](https://github.com/google/zx) with builtin support for [postgres.js](https://github.com/porsager/postgres)_

## Quick Start

```
# Run a migration script with full access to zx and sql globals
npx pgzx "$DATABASE_URL" migration.pg.js
```

```js
// migration.pg.js
const [{ a, b }] = await sql`select 1 as a, 2 as b`

const files = await $`ls -la`

console.log(chalk.green('Migration OK'))
```

## Options

```
Usage: pgzx [CONNECTION] [PGOPTIONS] [ZXOPTIONS]

[CONNECTION]

Pass a postgres connection string (just like psql), you can instead specify host/user etc as flags, or omit it entirely and use the defaults

[ZXOPTIONS]

Not all ZX functionality is supported.  We can add things on request.  But for now we're just
importing the zx library and importing and executing the provided script ourselves.

--quiet                     Run zx commands quietly
--shell                     Override the shell used by $
--prefix                    Prefix shell commands with an other command

[PGOPTIONS]

--begin                     Run entire script within a single transaction

Connection Options:

Note: We also support standard environment variables like PGUSER, PGHOST, PGPASSWORD

-h, --host=HOST             Specify hostname (defaut 127.0.0.1)
-p, --port=PORT             Specify port (default 5432)
-U, --username=USERNAME     Specify username (default 'postgres')
-X, --no-connect            Do not establish a connection automatically

--ssl 
    | --ssl                 Enables ssl
    | --ssl-prefer          Prefers ssl
    | --ssl-require         Requires ssl
    | --ssl-reject          Reject unauthorized connections
    | --no-ssl-reject       Do not reject unauthorized connections
    | --ssl-heroku          --no-ssl-reject if the connection string has a .com in it
    
    For more detailed connection options, connect to postgres manually
    via -X

```

_Note the following is lifted almost verbatim from google/zx's documentation with a few edits to adapt for usage with postgres, please checkout out google/zx repo for the latest documentation._

## CLI Options

### SSL

A brief explanatation of the many SSL flags and options.  The short of it is, we would all really like to enforce ssl but many hosting providers do not support SSL connections out of the box.  So if you are on heroku for example, you may want to use the special `--ssl-heroku` which sets ssl to `rejectUnauthorized: false` if the `PGHOST` is a `.com`.  When the host is an ip address, a local hostname, or `localhost` ssl will be disabled.

At such a time when Heroku supports SSL, this flag will change behaviour to `--ssl`, so its a good default for heroku users.

For more information on SSL connection configuration in postgres checkout the [postgres.js SSL documentation](https://github.com/porsager/postgres#ssl).

## Script Usage

### ``sql`SQLCOMMAND` ``

Checkout [postgres.js' excellent documentation](https://github.com/porsager/postgres#query-sql----promise) for a full walkthrough of what is possible with the `sql` and `pg` global

```js
const [user] = await sql`select * from users where user_id = ${1}`
```

### ``$`command` ``

Executes a given string using the `spawn` function from the
`child_process` package and returns `ProcessPromise<ProcessOutput>`.

```js
let count = parseInt(await $`ls -1 | wc -l`)
console.log(`Files count: ${count}`)
```

For example, to upload files in parallel:

```js
let hosts = [...]
await Promise.all(hosts.map(host =>
  $`rsync -azP ./src ${host}:/var/www`
))
```

If the executed program returns a non-zero exit code,
`ProcessOutput` will be thrown.

```js
try {
  await $`exit 1`
} catch (p) {
  console.log(`Exit code: ${p.exitCode}`)
  console.log(`Error: ${p.stderr}`)
}
```

#### `ProcessPromise`

```ts
class ProcessPromise<T> extends Promise<T> {
  readonly stdin: Writable
  readonly stdout: Readable
  readonly stderr: Readable
  readonly exitCode: Promise<number>
  pipe(dest): ProcessPromise<T>
}
```

The `pipe()` method can be used to redirect stdout:

```js
await $`cat file.txt`.pipe(process.stdout)
```

Read more about [pipelines](examples/pipelines.md).

#### `ProcessOutput`

```ts
class ProcessOutput {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
  toString(): string
}
```

### Functions

#### `cd()`

Changes the current working directory.

```js
cd('/tmp')
await $`pwd` // outputs /tmp
```

#### `fetch()`

A wrapper around the [node-fetch](https://www.npmjs.com/package/node-fetch) package.

```js
let resp = await fetch('http://wttr.in')
if (resp.ok) {
  console.log(await resp.text())
}
```

#### `question()`

A wrapper around the [readline](https://nodejs.org/api/readline.html) package.

Usage:

```js
let bear = await question('What kind of bear is best? ')
let token = await question('Choose env variable: ', {
  choices: Object.keys(process.env)
})
```

In second argument, array of choices for Tab autocompletion can be specified.

```ts
function question(query?: string, options?: QuestionOptions): Promise<string>
type QuestionOptions = { choices: string[] }
```

#### `sleep()`

A wrapper around the `setTimeout` function.

```js
await sleep(1000)
```

#### `nothrow()`

Changes behavior of `$` to not throw an exception on non-zero exit codes.

```ts
function nothrow<P>(p: P): P
```

Usage:

```js
await nothrow($`grep something from-file`)

// Inside a pipe():

await $`find ./examples -type f -print0`
  .pipe(nothrow($`xargs -0 grep something`))
  .pipe($`wc -l`)
```

If only the `exitCode` is needed, you can use the next code instead:

```js
if (await $`[[ -d path ]]`.exitCode == 0) {
  ...
}

// Equivalent of:

if ((await nothrow($`[[ -d path ]]`)).exitCode == 0) {
  ...
}
```

### Packages

Packages are available without importing inside scripts.

#### `postgres` package

The [postgres](https://www.npmjs.com/package/postgres) package.

```js
// Available globally as both pg and postgres
const sql = postgres(connectionOptions)
```

#### `chalk` package

The [chalk](https://www.npmjs.com/package/chalk) package.

```js
console.log(chalk.blue('Hello world!'))
```

#### `fs` package

The [fs-extra](https://www.npmjs.com/package/fs-extra) package.

```js
let content = await fs.readFile('./package.json')
```

#### `os` package

The [os](https://nodejs.org/api/os.html) package.

```js
await $`cd ${os.homedir()} && mkdir example`
```

#### `minimist` package

The [minimist](https://www.npmjs.com/package/minimist) package.

Available as global const `argv`.

### Configuration

#### `$.shell`

Specifies what shell is used. Default is `which bash`.

```js
$.shell = '/usr/bin/bash'
```

Or use a CLI argument: `--shell=/bin/bash`

#### `$.prefix`

Specifies the command that will be prefixed to all commands run.

Default is `set -euo pipefail;`.

Or use a CLI argument: `--prefix='set -e;'`

#### `$.quote`

Specifies a function for escaping special characters during
command substitution.

#### `$.verbose`

Specifies verbosity. Default is `true`.

In verbose mode, the `pgzx` prints all executed commands alongside with their
outputs.

Or use a CLI argument `--quiet` to set `$.verbose = false`.

### Polyfills

#### `__filename` & `__dirname`

In [ESM](https://nodejs.org/api/esm.html) modules, Node.js does not provide
`__filename` and `__dirname` globals. As such globals are really handy in scripts,
`pgzx` provides these for use in `.mjs` files (when using the `pgzx` executable).

#### `require()`

In [ESM](https://nodejs.org/api/modules.html#modules_module_createrequire_filename)
modules, the `require()` function is not defined.
The `pgzx` provides `require()` function, so it can be used with imports in `.mjs`
files (when using `pgzx` executable).

```js
let {version} = require('./package.json')
```

### FAQ

#### Passing env variables

```js
process.env.FOO = 'bar'
await $`echo $FOO`
```

#### Passing array of values

If array of values passed as argument to `$`, items of the array will be escaped
individually and concatenated via space.

Example:
```js
let files = [...]
await $`tar cz ${files}`
```

#### Importing from other scripts

It is possible to make use of `$` and other functions via explicit imports:

```js
#!/usr/bin/env node
import {$} from 'pgzx'
await $`date`
```

#### Unsupported ZX features

These features were ommited without prejudice.  They simply weren't available as exports on the zx library and things are a lot simpler if script execution is managed by pgzx not zx.  Will happily accept PRs to add these features back.

- Scripts without extensions
- Markdown scripts
- TypeScript support
- Stdin scripts

## License

All non referenced documentation and new code uses the [MIT Licence](https://opensource.org/licenses/MIT)

All referenced code and documentation from google/zx and postgres.js use their original licences:

- [porsager/postgres.js - Unlicense](https://github.com/porsager/postgres/blob/master/LICENSE)
- [google/zx - Apache Licence 2.0](https://github.com/google/zx/blob/main/LICENSE)


## Acknowledgements

Infinite thanks to the authors of [google/zx](https://github.com/google/zx) and [porsager/postgres](https://github.com/porsager/postgres), this package is merely a thin abstraction on top of 2 incredible API surfaces.

I never thought anyone would pry me away from bash or psql scripts but zx and postgres together create a very compelling scripting environment for migrations and operations.  

Without these two packages this package would never exist.