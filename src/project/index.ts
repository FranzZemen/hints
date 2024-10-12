/*
Created by Franz Zemen 11/04/2022
License Type: MIT
*/
import {EnhancedError, logErrorAndReturn, logErrorAndThrow} from '@franzzemen/enhanced-error';
import {LoggerAdapter} from '@franzzemen/logger-adapter';
import {ModuleDefinition} from '@franzzemen/module-factory';
import {FactoryType, ModuleResolutionActionInvocation, ModuleResolutionResult, ModuleResolutionSetterInvocation, ModuleResolver} from '@franzzemen/module-resolver';
import {v4 as uuidv4} from 'uuid';
import {ExecutionContext} from '@franzzemen/execution-context';


export interface HintAwaitingModuleLoad {
  key: string,
  module: ModuleDefinition
}


export class Hints extends Map<string, string | Object> {
  hintBody: string;
  // Hints are fully initialized, including asynchronous elements
  initialized = false;
  // Hints are loaded, not necessarily including asynchronous elements.
  loaded = false;
  resolverDedupId = uuidv4();

  constructor(hintBody: string, ec: ExecutionContext) {
    super();
    const log = new LoggerAdapter(ec, 'app-utility', 'hints', 'constructor');
    if (hintBody === undefined) {
      logErrorAndThrow(new EnhancedError('Undefined hint body'), new LoggerAdapter(ec, 'hints', 'hints', 'constructor'));
    }
    this.hintBody = hintBody.trim();
  }

  /**
   * Peeks at the next hint.  Module resolution is not guaranteed on return, as it is done locally.  Peek hints
   * is not intended for module load related results.  Note that loading commonjs, and from JSON files would be resolved.
   * For hints asynchronous resolution is limited JSON properties loaded from es modules.
   * @param near
   * @param prefix
   * @param ec
   * @param enclosure
   */
  static peekHints(near: string, prefix: string, ec: ExecutionContext, enclosure: { start: string, end: string } = {
    start: '<<',
    end: '>>'
  }): Hints {
    const localResolver = new ModuleResolver();
    Hints.validatePrefix(near, prefix, ec);
    const hints = Hints.captureHints(localResolver, near, prefix, ec, enclosure);
    // Ignore return
    localResolver.resolve(ec);
    return hints;
  }

  static peekAndResolveHints(near: string, prefix: string, ec: ExecutionContext, enclosure: { start: string, end: string } = {
    start: '<<',
    end: '>>'
  }): Hints | Promise<Hints> {
    Hints.validatePrefix(near, prefix, ec);
    return Hints.captureAndResolveHints(near, prefix, ec, enclosure);
  }

  static consumeHints(near: string, prefix: string, ec: ExecutionContext, enclosure: { start: string, end: string } = {
    start: '<<',
    end: '>>'
  }): string {
    // Capture remaining
    let remaining = near;
    //const remainingRegExp = new RegExp(`^${enclosure.start}${prefix}[-\\s\\t\\r\\n\\v\\f\\u2028\\u2029".,=>:\(\)@\\[\\]{}/_a-zA-Z0-9]*${enclosure.end}([^]*)$`);
    const remainingRegExp = new RegExp(`^${enclosure.start}${prefix}[-\\s".,=>:\(\)@\\[\\]{}/_a-zA-Z0-9]*${enclosure.end}([^]*)$`);
    const result2 = remainingRegExp.exec(remaining);
    if (result2) {
      // @ts-ignore
      remaining = result2[1].trim();
      return remaining;
    } else {
      // const err = new Error('Should never get here [no remaining]');
      // const log = new LoggerAdapter(ec, 'app-utility', 'hints', 'consumeHints');
      //logErrorAndThrow(err, log, ec);
      return remaining;
    }
  }

  static parseHints(moduleResolver: ModuleResolver, near: string, prefix: string, ec: ExecutionContext, enclosure: { start: string, end: string } = {
    start: '<<',
    end: '>>'
  }): [string, Hints] {
    const log = new LoggerAdapter(ec, 'app-utility', 'hints', 'parseHints');
    Hints.validatePrefix(near, prefix, ec);
    const hints = Hints.captureHints(moduleResolver, near, prefix, ec, enclosure);
    let remaining = Hints.consumeHints(near, prefix, ec, enclosure);
    return [remaining, hints];
  }

  static parseAndResolveHints(near: string, prefix: string, ec: ExecutionContext, enclosure: { start: string, end: string } = {
    start: '<<',
    end: '>>'
  }): [string, Hints | Promise<Hints>] {
    const log = new LoggerAdapter(ec, 'app-utility', 'hints', 'parseHints');
    Hints.validatePrefix(near, prefix, ec);
    const hintsResult = Hints.captureAndResolveHints(near, prefix, ec, enclosure);
    let remaining = Hints.consumeHints(near, prefix, ec, enclosure);
    return [remaining, hintsResult];
  }

  private static captureHints(moduleResolver: ModuleResolver, near: string, prefix: string, ec: ExecutionContext, enclosure: { start: string, end: string } = {
    start: '<<',
    end: '>>'
  }): Hints {
    const log = new LoggerAdapter(ec, 'app-utility', 'hints', 'captureHints');
    //const regExp = new RegExp(`^${enclosure.start}${prefix}([-\\s\\t\\r\\n\\v\\f\\u2028\\u2029".,=>:\(\)@\\[\\]{}/_a-zA-Z0-9]*)${enclosure.end}[^]*$`);
    const regExp = new RegExp(`^${enclosure.start}${prefix}([-\\s".,=>:\(\)@\\[\\]{}/_a-zA-Z0-9]*)${enclosure.end}[^]*$`);
    const result = regExp.exec(near);
    if (result) {
      // @ts-ignore
      const hints: Hints = new Hints(result[1].trim(), ec);
      hints.load(moduleResolver, prefix, ec);
      return hints;
    } else {
      log.debug(`Did not find hints near ${near}`);
      const hints = new Hints('', ec);
      hints.loadAndResolve('', ec);
      return hints;
    }
  }

  private static captureAndResolveHints(near: string, prefix: string, ec: ExecutionContext, enclosure: { start: string, end: string } = {
    start: '<<',
    end: '>>'
  }): Hints | Promise<Hints> {
    const log = new LoggerAdapter(ec, 'app-utility', 'hints', 'captureHints');
    //const regExp = new RegExp(`^${enclosure.start}${prefix}([-\\s\\t\\r\\n\\v\\f\\u2028\\u2029".,=>:\(\)@\\[\\]{}/_a-zA-Z0-9]*)${enclosure.end}[^]*$`);
    const regExp = new RegExp(`^${enclosure.start}${prefix}([-\\s".,=>:\(\)@\\[\\]{}/_a-zA-Z0-9]*)${enclosure.end}[^]*$`);
    const result = regExp.exec(near);
    if (result) {
      // @ts-ignore
      const hints: Hints = new Hints(result[1].trim(), ec);
      return hints.loadAndResolve(prefix, ec);
    } else {
      log.debug(`Did not find hints near ${near}`);
      const hints = new Hints('', ec);
      hints.loadAndResolve('', ec);
      return hints;
    }
  }

  private static validatePrefix(near: string, prefix: string, ec: ExecutionContext) {
    if (prefix) {
      if (!/^[a-z0-9]+[-a-z0-9]*[a-z0-9]+$/.test(prefix)) {
        const err = new EnhancedError(`Prefix must be lower case, use letters or numbers or the symbol -, but not at the start or the end.  It must be at least 2 characters long. Near ${near}`);
        const log = new LoggerAdapter(ec, 'app-utility', 'hints', 'validatePrefix');
        logErrorAndThrow(err, log);
      }
    }
  }

  // For use by ModuleResolver
  // @ts-ignore
  setHintResolution: ModuleResolutionSetterInvocation = (key: string, value: any, result: ModuleResolutionResult, ec: ExecutionContext) => {
    super.set(key, value);
    return Promise.resolve(true);
  };

  initActionResolution: ModuleResolutionActionInvocation = (successfulResolution: boolean, prefix: string, ec: ExecutionContext) => {
    // Regardless over overall success, that this method is called means that all module resoltuions associated with this
    // instance were satisfied.
    this.initialized = true;
    if (prefix && prefix.trim().length > 0) {
      super.set(prefix, prefix);
      super.set('prefix', prefix);
    }
    return Promise.resolve(true);
  };

  /**
   *
   * @param moduleResolver
   * @param prefix
   * @param ec
   */
  public load(moduleResolver: ModuleResolver, prefix: string, ec: ExecutionContext) {
    const log = new LoggerAdapter(ec, 'app-utility', 'hints', 'loadAndInitialize');
    // Locate name, value pairs with JSON
    let nvRegex = /([a-z0-9]+[-a-z0-9]*[a-z0-9]+)[\s]*=[\s]*([\[{][^]*[}|\]])/g;
    let match = undefined;
    let matchBoundaries: { start: number, end: number }[] = [];
    while ((match = nvRegex.exec(this.hintBody)) !== null) {
      // @ts-ignore
      const jsonStr = match[2].trim();
      try {
        const json = JSON.parse(jsonStr);
        // @ts-ignore
        super.set(match[1], json);
      } catch (err) {
        const error = new EnhancedError(`Cannot parse JSON hint ${jsonStr}`);
        log.error(err);
        logErrorAndThrow(error, log);
      }
      matchBoundaries.unshift({start: match.index, end: nvRegex.lastIndex});
    }
    // Build a new string removing prior results, which are sorted in reverse index
    let hintsCopy = this.hintBody;
    matchBoundaries.forEach(boundary => {
      hintsCopy = hintsCopy.substring(0, boundary.start) + hintsCopy.substring(boundary.end);
    });

    // Locate name, JSON from relative files
    nvRegex = /([a-z0-9]+[-a-z0-9]*[a-z0-9]+)[\s]*=[\s]*@\((require|import):([-a-zA-Z0-9 ./\\_]+\.json)\)/g;
    match = undefined;
    matchBoundaries = [];
    while ((match = nvRegex.exec(hintsCopy)) !== null) {
      // @ts-ignore
      const key = match[1].trim();
      // @ts-ignore
      const resource = match[3].trim();
      try {
        const module: ModuleDefinition = {
          moduleName: resource
        };

        moduleResolver.add({
                             refName: key,
                             loader: {
                               module,
                               factoryType: FactoryType.jsonFile
                             },
                             setter: {
                               ownerIsObject: true,
                               objectRef: this,
                               _function: 'setHintResolution',
                               paramsArray: [ec]
                             },
                             action: {
                               dedupId: this.resolverDedupId,
                               ownerIsObject: true,
                               objectRef: this,
                               _function: 'initActionResolution',
                               paramsArray: [prefix, ec]
                             }
                           }, ec);
      } catch (err) {
        const error = new Error(`Cannot load JSON from relative path ${resource}`);
        log.error(err);
        logErrorAndThrow(error, log);
      }
      matchBoundaries.unshift({start: match.index, end: nvRegex.lastIndex});
    }
    // Build a new string removing prior results, which are sorted in reverse index
    matchBoundaries.forEach(boundary => {
      hintsCopy = hintsCopy.substring(0, boundary.start) + hintsCopy.substring(boundary.end);
    });

    // Locate name, value pairs with quotes
    nvRegex = /([a-z0-9]+[-a-z0-9]*[a-z0-9]+)[\s]*=[\s]*"([.\/\-_a-zA-Z0-9\s]+)"/g;
    match = undefined;
    matchBoundaries = [];
    while ((match = nvRegex.exec(hintsCopy)) !== null) {
      // @ts-ignore
      super.set(match[1], match[2].trim());
      matchBoundaries.unshift({start: match.index, end: nvRegex.lastIndex});
    }
    // Build a new string removing prior results, which are sorted in reverse index
    matchBoundaries.forEach(boundary => {
      hintsCopy = hintsCopy.substring(0, boundary.start) + hintsCopy.substring(boundary.end);
    });

    // Locate name, value pairs without quotes
    nvRegex = /([a-z0-9]+[-a-z0-9]*[a-z0-9]+)[\s]*=[\s]*([.\/\-_a-zA-Z0-9]+)/g;
    match = undefined;
    matchBoundaries = [];
    while ((match = nvRegex.exec(hintsCopy)) !== null) {
      // @ts-ignore Left over from migration come back to fix this
      super.set(match[1], match[2]);
      matchBoundaries.unshift({start: match.index, end: nvRegex.lastIndex});
    }
    matchBoundaries.forEach(boundary => {
      hintsCopy = hintsCopy.substring(0, boundary.start) + hintsCopy.substring(boundary.end);
    });
    // Locate name, JSON from package/functions/attributes. Only creates the module definition.  Does not load the JSON inline for ES modules
    nvRegex = /([a-z0-9]+[-a-z0-9]*[a-z0-9]+)[\s]*=[\s]*@\((require|import):([a-zA-Z0-9 @./\\-_]+)(:|=>)([a-zA-Z0-9_.\[\]"']+)\)/g;
    match = undefined;
    matchBoundaries = [];
    while ((match = nvRegex.exec(hintsCopy)) !== null) {
      // @ts-ignore Left over from migration come back to fix this
      const key = match[1].trim();
      // @ts-ignore Left over from migration come back to fix this
      const moduleName = match[3].trim();
      // @ts-ignore Left over from migration come back to fix this
      const attribOrFunction = match[4].trim();
      let functionName: string, propertyName: string;
      if (attribOrFunction === ':') {
        // @ts-ignore Left over from migration come back to fix this
        propertyName = match[5].trim();
      } else {
        // @ts-ignore Left over from migration come back to fix this
        functionName = match[5].trim();
      }
      // @ts-ignore Left over from migration come back to fix this
      const module: ModuleDefinition = {
        moduleName,
        // @ts-ignore Left over from migration come back to fix this
        functionName,
        // @ts-ignore Left over from migration come back to fix this
        propertyName
      };
      // Do add the hint with a temporary placeholder, it will be replaced upon resolution.
      const tempHintValue: HintAwaitingModuleLoad = {
        key,
        module
      };
      super.set(key, tempHintValue);
      // We need to allow module resolver to just have an action...because here init will only be called if there's a module loaded and we need to set prefix once and abosulately once
      moduleResolver.add({
                           refName: key,
                           loader: {
                             module,
                             factoryType: FactoryType.jsonFactoryAttribute
                           },
                           setter: {
                             ownerIsObject: true,
                             objectRef: this,
                             _function: 'setHintResolution',
                             paramsArray: [ec]
                           },
                           action: {
                             dedupId: this.resolverDedupId,
                             ownerIsObject: true,
                             objectRef: this,
                             _function: 'initActionResolution',
                             paramsArray: [prefix, ec]
                           }
                         }, ec);
      matchBoundaries.unshift({start: match.index, end: nvRegex.lastIndex});
    }
    // Build a new string removing prior results, which are sorted in reverse index
    matchBoundaries.forEach(boundary => {
      hintsCopy = hintsCopy.substring(0, boundary.start) + hintsCopy.substring(boundary.end);
    });


    // Match unary...nothing left other than that, makes reg exp easy
    nvRegex = /\b([a-z0-9]+[-a-z0-9]*[a-z0-9]+)/g;
    match = undefined;
    matchBoundaries = [];
    while ((match = nvRegex.exec(hintsCopy)) !== null) {
      if(match[0] !== undefined) {
        super.set(match[0], match[0]);
      } else {
        throw new EnhancedError('Unexpected error in hints');
      }
      matchBoundaries.unshift({start: match.index, end: nvRegex.lastIndex});
    }
    matchBoundaries.forEach(boundary => {
      hintsCopy = hintsCopy.substring(0, boundary.start) + hintsCopy.substring(boundary.end);
    });
    // Regardless of whether we loaded anything or not, we are in the ModuleResolver's world and
    // need to guarantee this object is initialized, but use same dedupid
    // Only add module resolver action to initialize  if something was loaded.
    if (moduleResolver.hasPendingResolutions()) {
      moduleResolver.add({
                           refName: 'all',
                           action: {
                             dedupId: this.resolverDedupId,
                             ownerIsObject: true,
                             objectRef: this,
                             _function: 'initActionResolution',
                             paramsArray: [prefix, ec]
                           }
                         }, ec);
    } else {
      // Force initialization;
      this.initActionResolution(true, prefix, ec);
    }
    this.loaded = true;
  }

  loadAndResolve(prefix: string, ec: ExecutionContext): Hints | Promise<Hints> {
    const log = new LoggerAdapter(ec, 'app-utility', 'hints', 'loadAndResolve');
    const moduleResolver = new ModuleResolver();
    // @ts-ignore Left over from migration come back to fix this
    this.load(moduleResolver, prefix, ec);
    if (moduleResolver.hasPendingResolutions()) {
      const results = moduleResolver.resolve(ec);
      return results
        .then(resolutions => {
          const someErrors = ModuleResolver.resolutionsHaveErrors(resolutions);
          if (someErrors) {
            log.warn(resolutions, 'Errors resolving modules');
            throw logErrorAndReturn(new EnhancedError('Errors resolving modules'), new LoggerAdapter(ec, 'hints', 'hints', 'loadAndResolve'));
          } else {
            this.initialized = true;
            moduleResolver.clear(ec);
            return this;
          }
        });
    } else {
      return this;
    }
  }

  mergeInto(oHints: Hints, replace = false, ec: ExecutionContext) {
    this.checkInit(ec);
    let next;
    let iter = oHints.keys();
    while ((next = iter.next()) && !next.done) {
      const key = next.value;
      if (this.has(key,ec)) {
        if (replace) {
          // @ts-ignore Left over from migration come back to fix this
          this.set(key, oHints.get(key));
        }
      } else {
        // @ts-ignore Left over from migration come back to fix this
        this.set(key, oHints.get(key));
      }
    }
  }

  checkInit(ec: ExecutionContext) {
    if (!this.initialized) {
      if (!this.loaded) {
        const log = new LoggerAdapter(ec, 'app-utility', 'hints', 'checkInit');
        const err = new EnhancedError('Uninitialized Hints.  Either call init() or wait for settled promise; this can happen if Hints include loading JSON from an esModule');
        logErrorAndThrow(err, log);
      }
    }
  }

// @ts-ignore Left over from migration come back to fix this
  clear(ec: ExecutionContext) {
    this.checkInit(ec);
    super.clear();
  }

// @ts-ignore Left over from migration come back to fix this
  delete(key: string, ec: ExecutionContext): boolean {
    this.checkInit(ec);
    return super.delete(key);
  }

// @ts-ignore Left over from migration come back to fix this
  get(key: string, ec: ExecutionContext): string | Object | undefined {
    this.checkInit(ec);
    return super.get(key);
  }

// @ts-ignore Left over from migration come back to fix this
  has(key: string, ec: ExecutionContext): boolean {
    this.checkInit(ec);
    return super.has(key);
  }

// @ts-ignore Left over from migration come back to fix this
  set(key: string, value: string | Object, ec: ExecutionContext): this {
    this.checkInit(ec);
    return super.set(key, value);
  }
}

// Case 1:  Nothing precedes or follows
//        token
//
// Case 2:  A quote precedes
//
//    something"  token  ->  /"\s+([a-z0-9]+)
//
// Case 3:  A key follows
//
//    token key =
//
// Case 4:  Another token follows
//
//    token token1



