"use module"
import Defer from "p-defer"
import Delay from "delay"
import Dequeue from "dequeue"

export function AsyncIterPipeError( asyncIterPipe, err, msg= "AsyncIterPipeError"){
	Error.call( this, msg, err)
	this.asyncIterPipe= asyncIterPipe
}
AsyncIterPipeError.prototype = Object.create( Error.prototype)
AsyncIterPipeError.prototype.constructor = AsyncIterPipeError
export const PipeError= AsyncIterPipeError

export function AsyncIterPipeAbortError( asyncIterPipe, err, msg= "AsyncIterPipeAbortError"){
	AsyncIterPipeError.call( asyncIterPipe, err, msg)
}
AsyncIterPipeAbortError.prototype = Object.create( AsyncIterPipeError.prototype)
AsyncIterPipeAbortError.prototype.constructor = AsyncIterPipeAbortError
export const PipeAbortError= AsyncIterPipeAbortError

export function AsyncIterPipeDoneError( asyncIterPipe, err, msg= "AsyncIterPipeDoneError"){
	AsyncIterPipeError.call( asyncIterPipe, err, msg)
}
AsyncIterPipeDoneError.prototype = Object.create( AsyncIterPipeError.prototype)
AsyncIterPipeDoneError.prototype.constructor = AsyncIterPipeDoneError
export const PipeDoneError= AsyncIterPipeDoneError

const resolved= Promise.resolve()

// public facing symbols
export const
  AsyncIterPipeDrop= Symbol.for( "async-iter-pipe:drop"),
  Drop= AsyncIterPipeDrop

// internal symbols
export const
	_controller= Symbol.for( "async-iter-pipe:_controller"),
	_doneSignal= Symbol.for( "async-iter-pipe:_doneSignal"),
	_abortSignal= Symbol.for( "async-iter-pipe:_abortSignal")

export const controllerSignals= [
	{name: "abort", test: "aborted"}
]

export const listenerBinding= {
	passive: true,
	once: true
}

let n= 0

export class AsyncIterPipe{
	static DROP = Drop
	static get [ Symbol.species](){
		return Promise
	}
	static get controllerSignals(){ return controllerSignals}
	static get listenerBinding(){ return listenerBinding}

	// note: falsy values commented out

	// state
	done= false
	value= null
	reads= new Dequeue() // reads from consumers pending new values
	writes= new Dequeue() // writes from push awaiting readers

	readCount= 0
	writeCount= 0

	// not valid syntax?
	//[ _doneSignal]= Defer()

	// mode which is false
	//strictAsync= false

	constructor( opts){
		this._push= this._push.bind( this)
		if( opts){
			if( opts.controller){
				this.signal= opts.controller.signal
			}
			//if( opts.pushAfterReturn){
			//	this.pushAfterReturn= true
			//}
			if( opts.tail|| opts.sloppy){
				this.tail= opts.tail|| null
			}
			if( opts.strictAsync){
				this.strictAsync= true
			}
			if( opts.map){
				this.map= opts.map
			}
		}
	}

	push( ...items){
		let i= 0
		while( !this.done&& i< items.length){
			this._push(items[ i++])
		}
	}

	next(){
		// if we're done nothing more happens
		if( this.done){
			return {
				done: true,
				value: this.value
			}
		}

		// so this read is happening
		++this.readCount

		// use already pushed writes
		const hadWrites= this.writes&& this.writes.length
		if( hadWrites){
			const
			  value= this.value= this.writes.shift(),
			  iter= { value, done: false}
			return this.strictAysync? Promise.resolve( iter): iter
		}

		// queue up a new pending read
		let pending= Defer()
		this.reads.push( pending)
		return pending.promise
	}

	/**
	* Return number of stored write values ready to consume,
	* or if negative, the number of read values pending
	*/
	get queueCount(){
		if( this.writes&& this.writes.length){
			return this.writes.length
		}else if( this.reads&& this.reads.length){
			return -this.reads.length
		}else{
			return 0
		}
	}

	_push( value){
		// first check- still going?
		if( this.done){
			return
		}
		// sync-hronize
		if( value.then){
			value.then( this._push)
			return
		}
		++this.writeCount

		if( this.reads&& this.reads.length> 0){
			this.value= value
			const read= this.reads.shift()
			read.resolve({ value, done: false})

			let closing
			if( this.reads.length=== 0&& !!(closing= this.closing)){
				this.done= true
				if( this.returned){
					this.value= this.returnValue
				}else if( this.thrown){
					this.value= this.throwException
				}else if( this.aborted){
					this.value= this.abortException
				}
				if( this[ _doneSignal]){
					this[ _doneSignal].resolve( this)
				}
			}
			return
		}else{
			// value is already synchronous, since we've sync-hronized above
			this.writes.push( value)
		}
	}

	_end( value, ex){
		this.done= true
		this.returnValue= value
		this.throwException= ex

		// don't return until we really finish
		if( this.reads&& this.reads.length){
			return this.thenDone().then(()=> this._end( value, error))
		}

		// we're really finished, so signal as such
		if( this[ _doneSignal]){
			this[ _doneSignal].resolve({ value: this.value, done: true})
		}
		if( this[ _abortSignal]){
			// maybe already resolved, but insure it's not dangling
			this[ _abortsignal].reject()
		}
		return {
			done: true,
			value: value|| ex
		}
	}

	/**
	* Stop allowing push, and stop returning already pushd values.
	* If 'pushAfterReturn' mode is set, push will continue to fulfill already issues reads.
	*/
	return( value){
		if( this.closing){
			return 
		}
		this.returned= true
		this.returnValue= value
		return this._end( value)
	}
	/**
	* Immediately become done and reject any pending reads.
	*/
	throw( ex){
		if( this.closing){
			return
		}
		this.thrown= true
		this.throwException= ex
		return this._end( undefined, ex)
	}

	// TODO: implement AAAGGG UGGGH
	drain( value){
		if( this.closing){
			return
		}
		this.draining= true
		this.drainValue= true
	}

	/**
	*/
	abort( ex){
		if( this.closing){
			return
		}
		if(!( ex instanceof AsyncIterPipeAbortError)){
			ex= new AsyncIterPipeAbortError( this, ex)
		}
		this.aborted= true
		this.abortException= ex

		// outstanding reads get dropped
		for( let i= 0; i< this.reads.length; ++i){
			let read= this.reads[ i]
			read.reject( ex)
		}
		// raise the abort signal
		if( this[ _abortSignal]){
			this[ _abortSignal].resolve( ex)
		}

		// delay, then raise the done signal	
		return Delay().then(()=> this._end())
	}
	get closing(){
		if( this.drained){
			return "drained"
		}else if( this.draining){
			return "draining"
		}else if( this.returned){
			return "return"
		}if( this.aborted){
			return "abort"
		}else if( this.thrown){
			return "throw"
		}
	}

	[ Symbol.iterator](){
		return this
	}
	[ Symbol.asyncIterator](){
		return this
	}

	// signal for when everything finishes
	thenDone( ok, fail){
		if( !this[ _doneSignal]){
			this[ _doneSignal]= Defer()
		}
		if( ok|| fail){
			return this[ _doneSignal].promise.then( ok, fail)
		}
		return this[ _doneSignal].promise
	}
	// signal for abort
	thenAborted( ok, fail){
		if( !this[ _abortSignal]){
			this[ _abortSignal]= Defer()
		}
		if( ok|| fail){
			return this[ _abortSignal].promise.then( ok, fail)
		}
		return this[ _abortSignal].promise
	}


	get controller(){
		return this[ _controller]
	}
	set controller( controller){
		const oldController= this[ _controller]
		if( controller== oldController){
			return
		}
		for( const signal of (this.controllerSignals|| this.constructor.controllerSignals)){
			// get our listener
			const
			  listenerName= signal.name,
			  binding= signal.binding|| (this.listenerBinding|| this.constructor.listenerBinding)
			let listener= this[ listenerName]
			if( !listener){
				continue
			}
			// insure listener is bound
			if( listener=== this.constructor.prototype[ listenerName]){
				listener= this[ listenerName]= listener.bind( this)
			}
			// stop listening for old signals
			if( oldController){
				oldController.removeEventListener( signal, listener, binding)
			}
			// listen for signals
			if( controller){
				controller.addEventListener( signal, listener, binding)
			}
			// controller might already have signalled
			if( controller[ signal.test]){
				listener()
			}
		}
	}
}
export {
	AsyncIterPipe as default,
	AsyncIterPipe as asyncIterPipe,
	AsyncIterPipe as Pipe,
	AsyncIterPipe as pipe,
	AsyncIterPipeAbortError as asyncIterPipeAbortError,
	AsyncIterPipeAbortError as AbortException,
	AsyncIterPipeAbortError as abortException
}
