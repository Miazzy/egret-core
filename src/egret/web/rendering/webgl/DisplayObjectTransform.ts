//////////////////////////////////////////////////////////////////////////////////////
//
//  Copyright (c) 2014-present, Egret Technology.
//  All rights reserved.
//  Redistribution and use in source and binary forms, with or without
//  modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//     * Neither the name of the Egret nor the
//       names of its contributors may be used to endorse or promote products
//       derived from this software without specific prior written permission.
//
//  THIS SOFTWARE IS PROVIDED BY EGRET AND CONTRIBUTORS "AS IS" AND ANY EXPRESS
//  OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
//  OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
//  IN NO EVENT SHALL EGRET AND CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
//  INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
//  LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;LOSS OF USE, DATA,
//  OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
//  LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
//  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
//  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
//////////////////////////////////////////////////////////////////////////////////////

//测试开关
const useDisplayObjectTransform: boolean = true;

namespace egret.web {
    /**
     * 转换的整体封装
     */
    export class DisplayObjectTransform {
        /**
         * 测试用, 检查重构的结果
         * @param displayObject 
         * @param buffer 
         */
        public static debugCheckTransformMatchesExactly(displayObject: DisplayObject, buffer: WebGLRenderBuffer): boolean {
            if (!useDisplayObjectTransform || !displayObject) {
                return false;
            }
            const currentRenderNode = buffer.currentRenderNode;
            if (currentRenderNode) {
                const _textureTransform = currentRenderNode.textureTransform;
                if (!NumberUtils.matrixEqual(_textureTransform._matrix, buffer.globalMatrix)) {
                    console.error('WebGLRendererTransform debugCheckTransformMatchesExactly matrixEqual');
                    return false;
                }
                if (!NumberUtils.fequal(_textureTransform._offsetX, buffer.$offsetX)
                    || !NumberUtils.fequal(_textureTransform._offsetY, buffer.$offsetY)) {
                    console.error('WebGLRendererTransform debugCheckTransformMatchesExactly offset');
                    return false;
                }
            }
            return true;
        }
        /**
         * 将displayObject作为根部，做整体转换
         * @param displayObject 
         * @param buffer 
         * @param offsetX 
         * @param offsetY 
         */
        public static transformRoot(displayObject: DisplayObject, buffer: WebGLRenderBuffer, offsetX: number, offsetY: number): void {
            //设置为根节点，不再重复设置
            displayObject._worldTransform.set(buffer.globalMatrix, offsetX, offsetY);
            //开始遍历进行transform
            this.transformObject(displayObject, buffer, offsetX, offsetY);
        }   
        /**
         * 把一个transform复制给目标RenderNode的所有TextureTransform;
         * @param worldTransform 
         * @param renderNode 
         */
        public static copyTransformToRenderNodeTextureTransform(worldTransform: Transform, renderNode: egret.sys.RenderNode): void {
            switch (renderNode.type) {
                case sys.RenderNodeType.NormalBitmapNode:
                case sys.RenderNodeType.GraphicsNode:
                case sys.RenderNodeType.TextNode:
                case sys.RenderNodeType.GroupNode: {
                    renderNode.textureTransform.from(worldTransform);
                    break;
                }
                case sys.RenderNodeType.BitmapNode: 
                case sys.RenderNodeType.MeshNode: {
                    //
                    const node: sys.BitmapNode | sys.MeshNode = 
                    (renderNode.type === sys.RenderNodeType.BitmapNode ? renderNode as sys.BitmapNode : renderNode as sys.MeshNode);
                    //
                    const data = node.drawData;
                    const length = data.length;
                    const dataGroupCount = Math.floor(length / sys.BitmapNodeDrawDataIndex.MAX_SIZE);
                    node.resizeTextureTransformGroup(dataGroupCount);
                    //
                    let textureTransformIndex = 0;
                    let pos = 0;
                    while (pos < length) {
                        node.textureTransformIndex(textureTransformIndex);
                        node.textureTransform.from(worldTransform);
                        ++textureTransformIndex;
                        pos += sys.BitmapNodeDrawDataIndex.MAX_SIZE;
                    }
                    break;
                }
                default:
                    break;
            }
        }
        /**
         * 处理一个对象
         * @param displayObject 
         * @param buffer 
         * @param offsetX 
         * @param offsetY 
         */
        public static transformObject(displayObject: DisplayObject, buffer: WebGLRenderBuffer, offsetX: number, offsetY: number): void {
            if (!useDisplayObjectTransform) {
                return;
            }
            //
            const node = displayObject.$getRenderNode();
            if (node) {
                buffer.$offsetX = offsetX;
                buffer.$offsetY = offsetY;
                //临时, 这里需要再次重构
                const dirty = true;
                if (dirty /*&& displayObject*/) {
                    //父级的空间拷贝过来
                    const _worldTransform = displayObject._worldTransform;
                    const _matrix = _worldTransform._matrix;
                    // 
                    buffer.globalMatrix.setTo(_matrix.a, _matrix.b, _matrix.c, _matrix.d, _matrix.tx, _matrix.ty);
                    buffer.$offsetX = _worldTransform._offsetX;
                    buffer.$offsetY = _worldTransform._offsetY;
                    //根部拷贝worldTransform => every textureTransform
                    DisplayObjectTransform.copyTransformToRenderNodeTextureTransform(displayObject._worldTransform, node);
                }
                DisplayObjectTransform.transformRenderNode(displayObject, node, buffer);
                buffer.$offsetX = 0;
                buffer.$offsetY = 0;
            }
            //
            const children = displayObject.$children;
            if (children) {
                if (displayObject.sortableChildren && displayObject.$sortDirty) {
                    //绘制排序
                    displayObject.sortChildren();
                }
                const length = children.length;
                let child: DisplayObject;
                let offsetX2 = 0;
                let offsetY2 = 0;
                for (let i = 0; i < length; ++i) {
                    child = children[i];
                    //
                    const _worldTransform = child._worldTransform;
                    ////
                    const m3 = buffer.globalMatrix;
                    _worldTransform._matrix.setTo(m3.a, m3.b, m3.c, m3.d, m3.tx, m3.ty);
                    ////
                    let savedMatrix: Matrix;
                    if (child.$useTranslate) {
                        const m = child.$getMatrix();
                        offsetX2 = offsetX + child.$x;
                        offsetY2 = offsetY + child.$y;
                        const m2 = buffer.globalMatrix;
                        ////////////////////////////////////
                        //DisplayObjectTransform.$matrixTransform(_worldTransform._matrix, m.a, m.b, m.c, m.d, offsetX2, offsetY2);
                        _worldTransform.transform(m.a, m.b, m.c, m.d, offsetX2, offsetY2);
                        ////////////////////////////////////
                        savedMatrix = Matrix.create();
                        savedMatrix.a = m2.a;
                        savedMatrix.b = m2.b;
                        savedMatrix.c = m2.c;
                        savedMatrix.d = m2.d;
                        savedMatrix.tx = m2.tx;
                        savedMatrix.ty = m2.ty;
                        buffer.transform(m.a, m.b, m.c, m.d, offsetX2, offsetY2);
                        //////
                        offsetX2 = -child.$anchorOffsetX;
                        offsetY2 = -child.$anchorOffsetY;
                    }
                    else {
                        offsetX2 = offsetX + child.$x - child.$anchorOffsetX;
                        offsetY2 = offsetY + child.$y - child.$anchorOffsetY;
                    }
                    //  
                    _worldTransform.set(_worldTransform._matrix, offsetX2, offsetY2);
                    //
                    switch (child.$renderMode) {
                        case RenderMode.NONE:
                            break;
                        case RenderMode.FILTER:
                        case RenderMode.CLIP:
                            break;
                        case RenderMode.SCROLLRECT:
                            DisplayObjectTransform.transformScrollRect(child, buffer, offsetX2, offsetY2);
                            break;
                        default:
                            DisplayObjectTransform.transformObject(child, buffer, offsetX2, offsetY2);
                            break;
                    }
                    if (savedMatrix) {
                        const m = buffer.globalMatrix;
                        m.a = savedMatrix.a;
                        m.b = savedMatrix.b;
                        m.c = savedMatrix.c;
                        m.d = savedMatrix.d;
                        m.tx = savedMatrix.tx;
                        m.ty = savedMatrix.ty;
                        Matrix.release(savedMatrix);
                    }
                }
            }
        }
        /**
         * 转换的最后一步
         * @param _textureTransform 
         * @param image 
         * @param buffer 
         * @param destHeight 
         * @param destY 
         */
        private static _transform_(_textureTransform: Transform, image: BitmapData, buffer: WebGLRenderBuffer, destHeight: number, destY: number): void {
            let offsetX = 0;
            let offsetY = 0;
            if (image) {
                if (image["texture"] || (image.source && image.source["texture"])) {
                    buffer.saveTransform();
                    offsetX = buffer.$offsetX;
                    offsetY = buffer.$offsetY;
                    buffer.useOffset();
                    buffer.transform(1, 0, 0, -1, 0, destHeight + destY * 2); // 翻转

                    //
                    _textureTransform.flipY(destHeight + destY * 2);
                }
            }
            ///////////////////////////////////
            //这里应该什么都不做
            ///////////////////////////////////
            if (image) {
                if (image.source && image.source["texture"]) {
                    buffer.$offsetX = offsetX;
                    buffer.$offsetY = offsetY;
                    buffer.restoreTransform();
                }
            }
        }
        /**
         * 转换单图
         * @param displayObject 
         * @param node 
         * @param buffer 
         */
        private static transformBitmapSingle(displayObject: DisplayObject, node: sys.NormalBitmapNode, buffer: WebGLRenderBuffer): void {
            DisplayObjectTransform._transform_(node.textureTransform, node.image, buffer, node.drawH, node.drawY);
        }
        /**
         * 转换文字
         * @param displayObject 
         * @param node 
         * @param buffer 
         */
        private static transformText(displayObject: DisplayObject, node: sys.TextNode, buffer: WebGLRenderBuffer): void {
            let width = node.width - node.x;
            let height = node.height - node.y;
            if (width <= 0 || height <= 0 || !width || !height || node.drawData.length == 0) {
                return;
            }
            let canvasScaleX = egret.sys.DisplayList.$canvasScaleX;
            let canvasScaleY = egret.sys.DisplayList.$canvasScaleY;
            const maxTextureSize = buffer.context.$maxTextureSize;
            if (width * canvasScaleX > maxTextureSize) {
                canvasScaleX *= maxTextureSize / (width * canvasScaleX);
            }
            if (height * canvasScaleY > maxTextureSize) {
                canvasScaleY *= maxTextureSize / (height * canvasScaleY);
            }
            width *= canvasScaleX;
            height *= canvasScaleY;
            const x = node.x * canvasScaleX;
            const y = node.y * canvasScaleY;
            if (node.$canvasScaleX != canvasScaleX || node.$canvasScaleY != canvasScaleY) {
                node.$canvasScaleX = canvasScaleX;
                node.$canvasScaleY = canvasScaleY;
            }
            if (canvasScaleX !== 1 || canvasScaleY !== 1) {
            }
            ///
            const textureTransform = node.textureTransform;
            if (x || y) {
                buffer.transform(1, 0, 0, 1, x / canvasScaleX, y / canvasScaleY);
                textureTransform.transform(1, 0, 0, 1, x / canvasScaleX, y / canvasScaleY);
            }
            //
            if (x || y) {
                buffer.transform(1, 0, 0, 1, -x / canvasScaleX, -y / canvasScaleY);
            }
        }
        /**
         * 转换矢量绘图
         * @param displayObject 
         * @param node 
         * @param buffer 
         */
        private static transformGraphics(displayObject: DisplayObject, node: sys.GraphicsNode, buffer: WebGLRenderBuffer): void {
            let width = node.width;
            let height = node.height;
            if (width <= 0 || height <= 0 || !width || !height || node.drawData.length == 0) {
                return;
            }
            let canvasScaleX = egret.sys.DisplayList.$canvasScaleX;
            let canvasScaleY = egret.sys.DisplayList.$canvasScaleY;
            if (width * canvasScaleX < 1 || height * canvasScaleY < 1) {
                canvasScaleX = canvasScaleY = 1;
            }
            if (node.$canvasScaleX != canvasScaleX || node.$canvasScaleY != canvasScaleY) {
                node.$canvasScaleX = canvasScaleX;
                node.$canvasScaleY = canvasScaleY;
            }
            width = width * canvasScaleX;
            height = height * canvasScaleY;
            let width2 = Math.ceil(width);
            let height2 = Math.ceil(height);
            canvasScaleX *= width2 / width;
            canvasScaleY *= height2 / height;
            width = width2;
            height = height2;
            if (canvasScaleX !== 1 || canvasScaleY !== 1) {
            }
            //
            const textureTransform = node.textureTransform;
            if (node.x || node.y) {
                buffer.transform(1, 0, 0, 1, node.x, node.y);
                textureTransform.transform(1, 0, 0, 1, node.x, node.y);
            }
            ///
            if (node.x || node.y) {
                buffer.transform(1, 0, 0, 1, -node.x, -node.y);
            }
        }
        /**
         * 在转换Group里面做递归使用
         * @param displayObject 
         * @param fromNode 
         * @param toNode 
         * @param buffer 
         */
        private static transformRenderNodeRecursive(displayObject: DisplayObject, fromNode: sys.RenderNode, toNode: sys.RenderNode, buffer: WebGLRenderBuffer): void {
            if (!fromNode) {
                return;
            }
            if (fromNode.type === sys.RenderNodeType.GroupNode) {
                DisplayObjectTransform.copyTransformToRenderNodeTextureTransform(fromNode.textureTransform, toNode);
            }
            DisplayObjectTransform.transformRenderNode(displayObject, toNode, buffer);
        }
        /**
         * 转换一个RenderNode的TextureTransform
         * @param displayObject 
         * @param node 
         * @param buffer 
         */
        private static transformRenderNode(displayObject: DisplayObject, node: sys.RenderNode, buffer: WebGLRenderBuffer): void {
            switch (node.type) {
                case sys.RenderNodeType.BitmapNode:
                    DisplayObjectTransform.transformBitmapAtlas(displayObject, <sys.BitmapNode>node, buffer);
                    break;
                case sys.RenderNodeType.TextNode:
                    DisplayObjectTransform.transformText(displayObject, <sys.TextNode>node, buffer);
                    break;
                case sys.RenderNodeType.GraphicsNode:
                    DisplayObjectTransform.transformGraphics(displayObject, <sys.GraphicsNode>node, buffer);
                    break;
                case sys.RenderNodeType.GroupNode:
                    DisplayObjectTransform.transformGroup(displayObject, <sys.GroupNode>node, buffer);
                    break;
                case sys.RenderNodeType.MeshNode:
                    DisplayObjectTransform.transformMesh(displayObject, <sys.MeshNode>node, buffer);
                    break;
                case sys.RenderNodeType.NormalBitmapNode:
                    DisplayObjectTransform.transformBitmapSingle(displayObject, <sys.NormalBitmapNode>node, buffer);
                    break;
                default:
                    break;
            }
        }
        /**
         * 转换Group
         * @param displayObject 
         * @param groupNode 
         * @param buffer 
         */
        private static transformGroup(displayObject: DisplayObject, groupNode: sys.GroupNode, buffer: WebGLRenderBuffer): void {
            const m = groupNode.matrix;
            let savedMatrix: Matrix;
            let offsetX = 0;
            let offsetY = 0;
            if (m) {
                savedMatrix = egret.Matrix.create();
                const curMatrix = buffer.globalMatrix;
                savedMatrix.a = curMatrix.a;
                savedMatrix.b = curMatrix.b;
                savedMatrix.c = curMatrix.c;
                savedMatrix.d = curMatrix.d;
                savedMatrix.tx = curMatrix.tx;
                savedMatrix.ty = curMatrix.ty;
                offsetX = buffer.$offsetX;
                offsetY = buffer.$offsetY;
                buffer.useOffset();
                buffer.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
                ///
                const textureTransform = groupNode.textureTransform;
                textureTransform.useOffset();
                textureTransform.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
            }
            const children = groupNode.drawData;
            const length = children.length;
            for (let i = 0; i < length; i++) {
                const node = children[i];
                DisplayObjectTransform.transformRenderNodeRecursive(displayObject, groupNode, node, buffer);
            }
            if (m) {
                const matrix = buffer.globalMatrix;
                matrix.a = savedMatrix.a;
                matrix.b = savedMatrix.b;
                matrix.c = savedMatrix.c;
                matrix.d = savedMatrix.d;
                matrix.tx = savedMatrix.tx;
                matrix.ty = savedMatrix.ty;
                buffer.$offsetX = offsetX;
                buffer.$offsetY = offsetY;
                egret.Matrix.release(savedMatrix);
            }
        }
        /**
         * 转换图集处理
         * @param displayObject 
         * @param node 
         * @param buffer 
         */
        private static transformBitmapAtlas(displayObject: DisplayObject, node: sys.BitmapNode, buffer: WebGLRenderBuffer): void {
            const image = node.image;
            if (!image) {
                return;
            }
            const data = node.drawData;
            const length = data.length;
            let pos = 0;
            const m = node.matrix;
            let savedMatrix: Matrix;
            let offsetX = 0;
            let offsetY = 0;
            if (m) {
                savedMatrix = egret.Matrix.create();
                const curMatrix = buffer.globalMatrix;
                savedMatrix.a = curMatrix.a;
                savedMatrix.b = curMatrix.b;
                savedMatrix.c = curMatrix.c;
                savedMatrix.d = curMatrix.d;
                savedMatrix.tx = curMatrix.tx;
                savedMatrix.ty = curMatrix.ty;
                offsetX = buffer.$offsetX;
                offsetY = buffer.$offsetY;
                buffer.useOffset();
                buffer.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
            }
            let textureTransformIndex = 0;
            while (pos < length) {
                const destHeight = data[pos + sys.BitmapNodeDrawDataIndex.destHeight];
                const destY = data[pos + sys.BitmapNodeDrawDataIndex.destY];
                node.textureTransformIndex(textureTransformIndex);
                const curTextureTransform = node.textureTransform;
                if (m) {
                    curTextureTransform.useOffset();
                    curTextureTransform.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
                }
                DisplayObjectTransform._transform_(curTextureTransform, image, buffer, destHeight, destY);
                //
                ++textureTransformIndex;
                pos += sys.BitmapNodeDrawDataIndex.MAX_SIZE;
            }
            //
            if (m) {
                const matrix = buffer.globalMatrix;
                matrix.a = savedMatrix.a;
                matrix.b = savedMatrix.b;
                matrix.c = savedMatrix.c;
                matrix.d = savedMatrix.d;
                matrix.tx = savedMatrix.tx;
                matrix.ty = savedMatrix.ty;
                buffer.$offsetX = offsetX;
                buffer.$offsetY = offsetY;
                egret.Matrix.release(savedMatrix);
            }
        }
        /**
         * 转换一个mesh
         * @param displayObject 
         * @param node 
         * @param buffer 
         */
        private static transformMesh(displayObject: DisplayObject, node: sys.MeshNode, buffer: WebGLRenderBuffer): void {
            const image = node.image;
            const data = node.drawData;
            let length = data.length;
            let pos = 0;
            const m = node.matrix;
            let savedMatrix: Matrix;
            let offsetX = 0;
            let offsetY = 0;
            if (m) {
                savedMatrix = egret.Matrix.create();
                const curMatrix = buffer.globalMatrix;
                savedMatrix.a = curMatrix.a;
                savedMatrix.b = curMatrix.b;
                savedMatrix.c = curMatrix.c;
                savedMatrix.d = curMatrix.d;
                savedMatrix.tx = curMatrix.tx;
                savedMatrix.ty = curMatrix.ty;
                offsetX = buffer.$offsetX;
                offsetY = buffer.$offsetY;
                buffer.useOffset();
                buffer.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
            }
            let textureTransformIndex = 0;
            while (pos < length) {
                const destHeight = data[pos + sys.BitmapNodeDrawDataIndex.destHeight];
                const destY = data[pos + sys.BitmapNodeDrawDataIndex.destY];
                node.textureTransformIndex(textureTransformIndex);
                const curTextureTransform = node.textureTransform;
                if (m) {
                    curTextureTransform.useOffset();
                    curTextureTransform.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
                }
                DisplayObjectTransform._transform_(curTextureTransform, image, buffer, destHeight, destY);
                ++textureTransformIndex;
                pos += sys.BitmapNodeDrawDataIndex.MAX_SIZE;
            }
            //
            if (m) {
                const matrix = buffer.globalMatrix;
                matrix.a = savedMatrix.a;
                matrix.b = savedMatrix.b;
                matrix.c = savedMatrix.c;
                matrix.d = savedMatrix.d;
                matrix.tx = savedMatrix.tx;
                matrix.ty = savedMatrix.ty;
                buffer.$offsetX = offsetX;
                buffer.$offsetY = offsetY;
                egret.Matrix.release(savedMatrix);
            }
        }
        /**
         * 转换一个SrcollRect
         * @param displayObject 
         * @param buffer 
         * @param offsetX 
         * @param offsetY 
         */
        private static transformScrollRect(displayObject: DisplayObject, buffer: WebGLRenderBuffer, offsetX: number, offsetY: number): void {
            const scrollRect = displayObject.$scrollRect ? displayObject.$scrollRect : displayObject.$maskRect;
            if (scrollRect.isEmpty()) {
                return;
            }
            if (displayObject.$scrollRect) {
                offsetX -= scrollRect.x;
                offsetY -= scrollRect.y;
            }
            DisplayObjectTransform.transformObject(displayObject, buffer, offsetX, offsetY);
        }
    }
}